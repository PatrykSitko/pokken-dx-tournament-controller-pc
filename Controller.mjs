import { MissingEndpointError } from './Controller.errors.mjs';
import requireJSON from './modules/requireJSON.mjs';
import { errorCodes } from './Controller.errors.mjs';
import './modules/json/cycle.mjs';

const mappingSchemas = requireJSON('./json/controller-mappings.json');

export default class Controller {
  running = {};
  timeout = {};
  inputListeners = {};
  previousButtons = undefined;
  startedMonitoring = false;
  constructor(controller, buttonMapping) {
    this.controller = controller;
    this.buttonMapping = formatButtonMapping(buttonMapping);
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
    if (this.hasStartedMonitoring()) {
      return;
    }
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
      }
    }
  }
  stopMonitoring() {
    this.running.endpointListener = false;
    this.startedMonitoring = false;
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
          emitButtons.bind(this)(command);
        }
        clearTimeout(this.timeout.endpointListener);
        if (this.running.endpointListener) {
          this.timeout.endpointListener = loop.endpointListener.bind(this)();
        }
      }.bind(this)
    );
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

function emitButtons(command) {
  const currentButtons = [];
  const _command = `${command}`.split('');
  for (let index = 0; index < _command.length; index++) {
    if (index === 2 || index === 4) {
      continue;
    }
    let keys = parseInt(`0${_command[index]}`, 16);
    const candidates = this.buttonMapping[index];
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
    this.previousButtons = currentButtons;
    for (let inputListener in this.inputListeners) {
      this.inputListeners[inputListener].bind(this)({
        schema: this.schema,
        buttons: currentButtons
      });
    }
  }
}
