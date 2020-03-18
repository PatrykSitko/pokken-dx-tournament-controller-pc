import usb from 'usb';
import { MissingEndpointError } from './Controller.errors.mjs';
import { Worker, workerData } from 'worker_threads';
import './modules/json/cycle.mjs';

export default class Controller {
  worker = {};
  inputListeners = {};
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
  startMonitoring() {
    this.worker.endpoint = new Worker(
      './ControllerEndpointListener.worker.mjs',
      {
        workerData: JSON.stringify({
          idVendor: this.idVendor,
          idProduct: this.idProduct,
          deviceAddress: this.deviceAddress
        })
      }
    );
    this.worker.emmitter = new Worker('./ControllerInputEmmitter.worker.mjs', {
      workerData: JSON.stringify(
        JSON.decycle({
          buttonMapping: this.buttonMapping,
          endpoint: this.endpoint
        })
      )
    });
    this.worker.endpoint.on('message', ({ error, type, payload }) => {
      if (!error) {
        this.worker.emmitter.postMessage(
          JSON.stringify({ type: 'DATA', payload: command })
        );
      } else {
        switch (type) {
          default:
            throw new Error(payload);
          case 'MISSING_ENDPOINT_ERROR':
            throw new MissingEndpointError(payload);
        }
      }
    });
  }
  stopMonitoring() {
    this.worker.endpoint.postMessage(
      JSON.stringify({ type: 'TERMINATE', payload: null })
    );
  }
  addInputListener(callback = (err, buttons) => {}) {
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
