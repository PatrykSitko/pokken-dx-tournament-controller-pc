import usb from 'usb';
import Controller from './Controller.mjs';
import requireJSON from './modules/requireJSON.mjs';

const SupportedControllers = requireJSON(`/json/supported-controllers.json`);
export default class Controllers {
  controllers = [];
  constructor() {
    findSupportedControllers.bind(this)();
    startMonitoring.bind(this)();
  }
  getControllers() {
    return this.controllers;
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
        this.controllers.push(
          new Controller(potentialController, buttonMapping)
        );
      }
    }
  }
}

function startMonitoring() {
  setInterval(() => {
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
        this.controllers[controller].stopMonitoring();
        this.controllers.splice(controller, 1);
        findSupportedControllers.bind(this)();
      }
    }
  }, 100);
}

const controller = new Controllers().getControllers()[0];
controller.startMonitoring();
setInterval(() => {}, 100);
