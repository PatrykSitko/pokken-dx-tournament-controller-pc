import { MissingEndpointError } from './Controller.errors.mjs';
import requireJSON from './modules/requireJSON.mjs';
import { errorCodes } from './Controller.errors.mjs';
import './modules/json/cycle.mjs';

const mappingSchemas = requireJSON('./json/controller-mappings.json');

export default class Controller {
  running = {};
  timeout = {};
  inputListeners = {};
  buttons = [];
  previousButtons = undefined;
  notify = [];
  startedMonitoring = false;
  constructor(controller, buttonMapping) {
    this.controller = controller;
    this.buttonMapping = buttonMapping;
  }
  get idVendor() {
    return this.controller.deviceDescriptor.idVendor;
  }
  get idProduct() {
    return this.controller.deviceDescriptor.idProduct;
  }
  get deviceAddress() {
    return this.controller.deviceAddress;
  }

  hasStartedMonitoring() {
    return this.startedMonitoring;
  }
  isMonitoring() {
    for (let isMonitoring of Object.values(this.running)) {
      if (!isMonitoring) {
        return false;
      }
    }
    return true;
  }

  startMonitoring() {
    this.startedMonitoring = true;
    if (this.controller) {
      this.controller.open();
      this.interface = this.controller.interface(0);
      this.interface.claim();
      for (let entry of this.interface.endpoints) {
        if (entry.constructor.name === 'InEndpoint') {
          this.endpoint = this.interface.endpoint(entry.address);
        }
      }
      if (!this.endpoint) {
        throw new MissingEndpointError();
      }
      if (this.endpoint) {
        this.endpoint.timeout = this.controller.timeout;
        const schemasInUse = Object.values(this.mappingSchemasInUse);
        for (let { idVendor, idProduct, schema } of Object.values(
          mappingSchemas
        )) {
          if (idVendor === this.idVendor && idProduct === this.idProduct) {
            const availableSchemas = Object.keys(schema).filter(
              schema => !schemasInUse.includes(schema)
            );
            let choosenSchema = undefined;
            if (availableSchemas.length === 0) {
              if (this.mappingSchemasInUse[this.deviceAddress]) {
                choosenSchema = this.mappingSchemasInUse[this.deviceAddress];
              }
            } else {
              choosenSchema = availableSchemas.shift();
            }
            if (choosenSchema) {
              this.addMappingSchemaInUse(this.deviceAddress, choosenSchema);
              this.schemaInUse = choosenSchema;
              this.schema = schema[choosenSchema];
            }
          }
        }
        this.timeout.endpointListener = loop.endpointListener.bind(this)();
        this.timeout.inputEmitter = loop.inputEmitter.bind(this)();
      }
    }
  }
  stopMonitoring() {
    this.running.endpointListener = false;
    this.running.inputEmitter = false;
  }
  addInputListener(callback = ({ schema, buttons }) => {}) {
    if (typeof callback !== 'function') {
      return undefined;
    }
    const id = callback.toString();
    this.inputListeners[id] = callback;
    return id;
  }
  removeInputListener(inputListener) {
    if (
      typeof inputListener !== 'function' ||
      typeof inputListener !== 'string'
    ) {
      return false;
    }
    let id =
      typeof inputListener === 'function'
        ? inputListener.toString()
        : inputListener;
    delete this.inputListeners[id];
    return true;
  }
}

const loop = {
  endpointListener: function() {
    this.running.endpointListener = true;
    return setTimeout(
      async function() {
        let command = await transfer.bind(this)();
        if (command) {
          command = command.substring(0, 6);
          command = command.endsWith('f')
            ? `${command.substring(0, command.length - 1)}0`
            : command.endsWith('0')
            ? `${command.substring(0, command.length - 1)}f`
            : command;
          this.command = command;
          mapButtons.bind(this)();
        }
        clearTimeout(this.timeout.endpointListener);
        if (this.running.endpointListener) {
          this.timeout.endpointListener = loop.endpointListener.bind(this)();
        }
      }.bind(this),
      1
    );
  },
  inputEmitter: function() {
    this.running.inputEmitter = true;
    return setTimeout(async () => {
      if (this.notify.length > 0) {
        const buttons = this.notify.shift();
        if (JSON.stringify(buttons) !== JSON.stringify(this.previousButtons))
          new Promise(resolve => {
            for (let inputListener in this.inputListeners) {
              this.inputListeners[inputListener].bind(this)({
                schema: this.schema,
                buttons
              });
              resolve();
            }
          });
      }
      clearTimeout(this.timeout.inputEmitter);
      if (this.running.inputEmitter) {
        this.timeout.inputEmitter = loop.inputEmitter.bind(this)();
      }
    }, 1);
  }
};

async function transfer() {
  try {
    return await new Promise((resolve, reject) =>
      this.endpoint.transfer(
        this.endpoint.descriptor.wMaxPacketSize,
        (err, data) => {
          err ? reject(err) : resolve(data.toString('hex'));
        }
      )
    );
  } catch (error) {
    console.log(error, error.errno);
    switch (error.errno) {
      case errorCodes.LIBUSB_TRANSFER_ERROR:
      case errorCodes.LIBUSB_ERROR_NOT_FOUND:
        this.stopMonitoring();
        break;
    }
  }
}
function formatButtonMapping(buttonMapping) {
  const regroupedButtonMapping = {};
  for (let key in buttonMapping) {
    if (typeof buttonMapping[key] === 'function') {
      continue;
    }
    const { index, value } = buttonMapping[key];
    if (typeof regroupedButtonMapping[index] !== 'object') {
      regroupedButtonMapping[index] = {};
    }
    regroupedButtonMapping[index][value] = key;
  }
  return regroupedButtonMapping;
}

function mapButtons() {
  const currentButtons = [];
  const command = `${this.command}`.split('');
  for (let index = 0; index < command.length; index++) {
    if (index === 2 || index === 4) {
      continue;
    }
    let keys = parseInt(`0${command[index]}`, 16);
    const candidates = formatButtonMapping(this.buttonMapping)[index];
    const candidateValues = Object.keys(candidates).sort((a, b) => b - a);
    for (let candidate of candidateValues) {
      if (candidate > keys) {
        continue;
      }
      if (keys - candidate < 0) {
        break;
      }
      currentButtons.push(candidates[candidate]);
      keys -= candidate;
    }
  }
  if (JSON.stringify(this.previousButtons) !== JSON.stringify(currentButtons)) {
    this.previousButtons = this.buttons;
    this.notify.push(currentButtons);
  }
  this.buttons = currentButtons;
}
