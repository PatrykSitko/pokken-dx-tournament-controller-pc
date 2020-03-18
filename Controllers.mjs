import usb from 'usb';
import Controller from './Controller.mjs';
import requireJSON from './modules/requireJSON.mjs';

const SupportedControllers = requireJSON(`/json/supported-controllers.json`);
export default class Controllers {
  controllers = [];
  mappingSchemasInUse = {};
  constructor() {
    findSupportedControllers.bind(this)();
    this.interval = startMonitoring.bind(this)();
  }
  addMappingSchemaInUse(deviceAddress, schema) {
    this.mappingSchemasInUse[deviceAddress] = schema;
  }
  getControllers() {
    return this.controllers;
  }
  close() {
    for (const controller of this.controllers) {
      controller.stopMonitoring();
    }
    clearInterval(this.interval);
  }
}

function findSupportedControllers() {
  const supportedControllers = Object.values(SupportedControllers);
  for (let potentialController of usb.getDeviceList()) {
    const {
      deviceDescriptor: { idVendor: deviceIdVendor, idProduct: deviceIdProduct }
    } = potentialController;
    for (const { idVendor, idProduct, buttonMapping } of supportedControllers) {
      if (idVendor === deviceIdVendor && idProduct === deviceIdProduct) {
        const controller = new Controller(potentialController, buttonMapping);
        controller.mappingSchemasInUse = this.mappingSchemasInUse;
        controller.addMappingSchemaInUse = this.addMappingSchemaInUse;
        this.controllers.push(controller);
      }
    }
  }
}

function startMonitoring() {
  return setInterval(() => {
    for (let controller in this.controllers) {
      const { idVendor, idProduct, deviceAddress } = this.controllers[
        controller
      ];
      let deleteController = true;
      for (let potentialController of usb.getDeviceList()) {
        const {
          deviceDescriptor: {
            idVendor: potentialDeviceIdVendor,
            idProduct: potentialDeviceIdProduct
          },
          deviceAddress: potentialDeviceAddress
        } = potentialController;
        if (
          idVendor === potentialDeviceIdVendor &&
          idProduct === potentialDeviceIdProduct &&
          deviceAddress === potentialDeviceAddress
        ) {
          deleteController = false;
          break;
        }
      }
      if (deleteController) {
        delete this.mappingSchemasInUse[deviceAddress];
        this.controllers[controller].stopMonitoring();
        this.controllers.splice(controller, 1);
        findSupportedControllers.bind(this)();
      }
      this.controllers[
        controller
      ].mappingSchemasInUse = this.mappingSchemasInUse;
    }
  }, 1);
}

const controller = new Controllers().getControllers()[0];
controller.startMonitoring();
controller.addInputListener(({ buttons }) => console.log(buttons));
// console.log(controller.controller, controller.interface, controller.endpoint);
