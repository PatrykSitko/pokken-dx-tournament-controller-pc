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
          let previousButtons = [previousButton];
          if (previousButton.includes('-')) {
            previousButtons = previousButton.split('-');
          }
          for (let previousButton of previousButtons) {
            if (buttons.includes(previousButton)) {
              return true;
            } else {
              robot.keyToggle(schema[previousButton], 'up');
              return false;
            }
          }
        });
        buttons.forEach(button => {
          let buttons = [button];
          if (button.includes('-')) {
            buttons = button.split('-');
          }
          for (let button of buttons) {
            if (!previousButtons.includes(button)) {
              robot.keyToggle(schema[button], 'down');
              previousButtons.push(button);
            }
          }
        });
      }
    });
  }
}, 1);
