import Controllers from './Controllers.mjs';
import robot from './modules/robotjs/index.js';

let previousButtons = [];
const controllers = new Controllers();
setInterval(() => {
  for (let controller of controllers.get()) {
    controller.startMonitoring();
    controller.addInputListener(({ schema, buttons }) => {
      if (JSON.stringify(buttons) !== JSON.stringify(previousButtons)) {
        previousButtons = previousButtons.filter(previousButton => {
          if (buttons.includes(previousButton)) {
            return true;
          } else {
            robot.keyToggle(schema[previousButton], 'up');
            return false;
          }
        });
        buttons.forEach(button => {
          if (!previousButtons.includes(button)) {
            robot.keyToggle(schema[button], 'down');
            previousButtons.push(button);
          }
        });
      }
    });
  }
}, 1);
