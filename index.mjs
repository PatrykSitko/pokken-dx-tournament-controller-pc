import Controllers from './Controllers.mjs';
import robot from 'robotjs';

let previousButtons = [];
const controllers = new Controllers();
setInterval(() => {
  for (let controller of controllers.get()) {
    controller.startMonitoring();
    controller.addInputListener(({ schema, buttons }) => {
      if (JSON.stringify(buttons) !== JSON.stringify(previousButtons)) {
        if (buttons.length > 0) {
          for (let button of buttons) {
            if (previousButtons.includes(button)) {
              continue;
            }
            robot.keyToggle(schema[button], 'down');
            previousButtons.push(button);
          }
        } else {
          for (const button of previousButtons) {
            robot.keyToggle(schema[button], 'up');
          }
          previousButtons = [];
        }
      }
    });
  }
}, 1);
