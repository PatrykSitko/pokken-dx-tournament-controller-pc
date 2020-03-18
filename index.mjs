import Controllers from './Controllers.mjs';

const controller = new Controllers().getControllers()[0];
controller.startMonitoring();
controller.addInputListener(({ buttons }) => console.log(buttons));
