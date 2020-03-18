import usb from 'usb';
// import robot from 'robotjs';

const controllerInfo = {
  idVendor: 3853,
  idProduct: 146,
  idRevision: 256
};

const controller = usb.findByIds(
  controllerInfo.idVendor,
  controllerInfo.idProduct
);
// console.log(controller);
controller.open();
const controllerInterface = controller.interface(0);
console.log(controllerInterface.endpoints[0]);
controllerInterface.claim();
const controllerInEndpoint = controllerInterface.endpoint(129);
controllerInEndpoint.timeout = controller.timeout;
const loop = () =>
  new Promise((resolve, reject) =>
    controllerInEndpoint.transfer(64, (err, data) => {
      err ? reject(err) : resolve(data.toString('hex').substring(0, 6));
    })
  );
const sleep = millis =>
  new Promise(resolve =>
    setTimeout(() => {
      resolve();
    }, millis)
  );
(async () => {
  let toggled = false;
  while (true) {
    try {
      let command = await loop();
      if (command !== '00000f') {
        command = command.endsWith('f')
          ? `${command.substring(0, command.length - 1)}0`
          : command.endsWith('0')
          ? `${command.substring(0, command.length - 1)}f`
          : command;
        console.log(buttonMapping.getActiveButtonMappings(command));
      }
    } catch (e) {
      console.error(e);
    }
    // await sleep(5);
  }
})();
const buttonMapping = {
  l: {
    index: 0,
    value: 1
  },
  r: {
    index: 0,
    value: 2
  },
  zl: {
    index: 0,
    value: 4
  },
  zr: {
    index: 0,
    value: 8
  },
  a: {
    index: 1,
    value: 4
  },
  b: {
    index: 1,
    value: 2
  },
  y: {
    index: 1,
    value: 1
  },
  x: {
    index: 1,
    value: 8
  },
  select: {
    index: 3,
    value: 1
  },
  start: {
    index: 3,
    value: 2
  },
  up: {
    index: 5,
    value: 15
  },
  down: {
    index: 5,
    value: 4
  },
  left: {
    index: 5,
    value: 6
  },
  right: {
    index: 5,
    value: 2
  }
};
buttonMapping.getGroupedByIndex = function() {
  const regroupedButtonMapping = {};
  for (let key in buttonMapping) {
    if (typeof buttonMapping[key] === 'function') {
      continue;
    }
    const { index, value } = buttonMapping[key];
    if (typeof regroupedButtonMapping[index] !== 'object') {
      regroupedButtonMapping[index] = {};
    }
    regroupedButtonMapping[index][key] = value;
  }
  return regroupedButtonMapping;
};
buttonMapping.getGroupedByIndexAlt = function() {
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
};

buttonMapping.getActiveButtonMappings = function(command) {
  const buttons = [];
  const command_ = `${command}`.split('');
  for (let index = 0; index < command_.length; index++) {
    if (index === 2 || index === 4) {
      continue;
    }
    let keys = parseInt(`0${command_[index]}`, 16);
    const candidates = buttonMapping.getGroupedByIndexAlt()[index];
    const candidateValues = Object.keys(candidates).sort((a, b) => b - a);
    for (let candidate of candidateValues) {
      if (candidate > keys) {
        continue;
      }
      if (keys - candidate < 0) {
        break;
      }
      buttons.push(candidates[candidate]);
      keys -= candidate;
    }
  }
  return buttons;
};
