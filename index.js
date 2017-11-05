let axios = require('axios');
let {
  JSDOM
} = require('jsdom');
let jqFactory = require('jquery');

const browserHeader = {
  'User-Agent': `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.75 Safari/537.36`,
  'Upgrade-Insecure-Requests': 1,
  'Pragma': 'no-cache',
  'Accept-Language': `ja,en-US;q=0.9,en;q=0.8`,
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive'
};
const isDebug = false;
const urlBase = `http://www.battlespirits.com/feature/10th-anniversary/dreamdeck/`;

let selectedValue = `バトルスピリッツ ソードアイズ：光と闇の邂逅`;
// let selectedValue = `最強銀河 究極ゼロ 〜バトルスピリッツ〜：究極のゼロ`;
let ip = `153.140.21.1`;

function getIp() {
  let ipArray = ip.split('.').map(num => Number(num));
  ipArray[3]++;
  for (let i = 3; i > 0; i--) {
    if (ipArray[i] > 254) {
      ipArray[i - 1]++;
      ipArray[i] = 1;
    }
  }
  return ip = ipArray.join('.');
}
async function getFirstPage() {
  let fakeIp = getIp();
  let res = await axios.get(urlBase, {
    headers: {
      ...browserHeader,
      'X-Forwarded-For': fakeIp
    }
  });

  let cookieSplitArray = res.headers['set-cookie'][0].split(/[=;]/);
  if (cookieSplitArray[0].toUpperCase() == 'PHPSESSID') {
    debug('sessionID get! :', cookieSplitArray[1]);
  } else {
    throw new Error(`error occured at getting sessionID: ${cookieSplitArray[0]}`)
  }

  let sessionID = cookieSplitArray[1];
  let { window } = new JSDOM(res.data),
    $ = jqFactory(window);
  
  let formViewValue = $('form input[name=view]')[0].value;
  if (formViewValue) {
    debug('form view value get! :', formViewValue);
  } else {
    throw new Error(`error occured at getting form view value.`);
  }
  return {
    formData: {
      view: formViewValue,
      entry: true,
      submit2: `投票する`,
      head_1: selectedValue
    },
    cookie: `PHPSESSID=${sessionID}`,
    ip: fakeIp
  };
}

function getGACookie() {
  let num8 = Math.random() * 100000000;
  while (num8 < 10000000) {
    num8 *= 10;
  }
  let num10 = Math.random() * 100000000;
  while (num10 < 1000000000) {
    num10 *= 10;
  }
  let dateNow = Date.now() / 1000;
  [num8, num10, dateNow] = [num8, num10, dateNow].map(num => (num + '').split('.')[0]);
  return `_ga=GA1.2.${num8}.${dateNow}; _gid=GA1.2.${num10}.${dateNow}`;
}

function sleep(time) {
  return new Promise(resolve => setTimeout(resolve, time));
}

async function submitFirstPage(info) {
  let cookie = `${info.cookie}; ${getGACookie()}`;
  // sleep 2 seconds for csrf token sync
  await sleep(Math.ceil(Math.random() * 1000) + 1000);
  let res = await axios.post(`${urlBase}index.php`, info.formData, {
    headers: {
      ...browserHeader,
      Cookie: cookie,
      'X-Forwarded-For': info.ip
    }
  });

  let { window } = new JSDOM(res.data),
    $ = jqFactory(window);
  debug($('.chara-voteTxt_check').text().trim());

  let formViewValue;
  try {
    formViewValue = $('form input[name=view]')[0].value
  } catch (e) {}
  if (formViewValue) {
    debug('second form view value get! :', formViewValue);
  } else {
    throw new Error(`error occured at getting second form view value.`);
  }
  return {
    formData: {
      view: formViewValue,
      submit: `投票する`,
      comp: true
    },
    cookie,
    ip: info.ip
  }
}

async function submitSecondPage(info) {
  // sleep 1 seconds for like a human
  await sleep(Math.ceil(Math.random() * 1000) + 500);
  let res = await axios.post(`${urlBase}index.php`, info.formData, {
    headers: {
      ...browserHeader,
      Cookie: info.cookie,
      'X-Forwarded-For': info.ip
    }
  });
  let { window } = new JSDOM(res.data),
    $ = jqFactory(window);
  let message = $('#vote_cont img').attr('alt');

  if (message) {
    debug(message);
    successTimes++;
  } else {
    throw new Error('Final submit error!');
  }
}

function debug(...args) {
  if (isDebug) {
    console.log(...args);
  }
}

var successTimes = 0;

// post transform
let qs = require('qs');
axios.interceptors.request.use(config => {
  if (config.method == 'post') {
    config.data = qs.stringify(config.data);
  }
  return config;
}, err => {
  return Promise.reject(err);
});

function autoGo() {
  return getFirstPage().then(submitFirstPage).then(submitSecondPage).then(() => {
    debug(successTimes);
    if (successTimes % 1000 === 0 && successTimes != 0) {
      console.log(`${successTimes} Times Successed!`);
    }
    return sleep(Math.ceil(Math.random() * 1000) + 500);
  }).then(() => autoGo()).catch(e => console.error(e.message, e.stack));
}

for (let i = 0; i < 5; i++) {
  autoGo();
}