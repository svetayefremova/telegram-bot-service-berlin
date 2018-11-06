require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const request = require('request');
const cheerio = require('cheerio');

const URL = 'https://service.berlin.de';
const PATH = '/terminvereinbarung/termin/tag.php?termin=1&dienstleister=327795&anliegen[]=318962&herkunft=1';

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

const getPage = (cb, path) => {
  request(`${URL}${path}`, {
    timeout: 3000,
    jar: true,
  }, (error, response, body) => {
    if (!error) {
      cb(body);
    } else {
      // eslint-disable-next-line
      console.error('Error', error);
    }
  });
};

const parsePage = (data, output = [], isNextPage = false) => {
  const $ = cheerio.load(data);

  if (!isNextPage) {
    $('.calendar-month-table').each((i, elem) => {
      const $month = $(elem).find('.month');
      const notBooked = $(elem).find('.buchbar');
      notBooked.each((index, el) => {
        const date = `${$(el).text()} ${$month.text()}`;
        output.push(date);
      });
    });
  } else {
    const $month = $('.calendar-month-table').last().find('.month');
    const notBooked = $('.calendar-month-table').last().find('.buchbar');
    notBooked.each((index, el) => {
      const date = `${$(el).text()} ${$month.text()}`;
      output.push(date);
    });
  }

  return output;
};

const subscribedUsers = [];

bot.onText(/\/subscribe/, (msg) => {
  const userId = msg.from.id;
  subscribedUsers.push({ uid: userId });
  bot.sendMessage(userId, 'Cool! I will send message if I find day for appointment :)');
});

bot.onText(/\/unsubscribe/, (msg) => {
  const userId = msg.from.id;
  if (subscribedUsers.length) {
    const userIndex = subscribedUsers.map(el => el.uid).indexOf(userId);
    bot.sendMessage(subscribedUsers[userIndex].uid, 'You have successfully unsubscribed from the service');
    subscribedUsers.splice(userIndex, 1);
  }
});

setInterval(() => {
  getPage((html) => {
    const $ = cheerio.load(html);
    const output = parsePage(html);
    const nextPagePath = $('.calendar-month-table').find('.next a').attr('href');
    if (nextPagePath) {
      getPage((html2) => {
        const resultData = parsePage(html2, output, true);
        if (resultData && resultData.length && subscribedUsers.length) {
          // eslint-disable-next-line
          for (let user of subscribedUsers) {
            bot.sendMessage(user.uid, `I found dates for appointment:\n${resultData.join('\n')}`);
          }
          subscribedUsers.splice(0, subscribedUsers.length);
        }
      }, nextPagePath);
    }
  }, PATH);
}, 15 * 60000);
