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
            if (previousButton.includes('-')) {
              for (let button of previousButton.split('-')) {
                robot.keyToggle(schema[button], 'up');
              }
            } else {
              robot.keyToggle(schema[previousButton], 'up');
            }
            return false;
          }
        });
        buttons.forEach(button => {
          if (!previousButtons.includes(button)) {
            if (button.includes('-')) {
              for (let _button of button.split('-')) {
                robot.keyToggle(schema[_button], 'down');
              }
            } else {
              robot.keyToggle(schema[button], 'down');
            }
            previousButtons.push(button);
          }
        });
      }
    });
  }
}, 1);
