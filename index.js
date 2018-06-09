const Discord = require('discord.js');
const client = new Discord.Client();
const schedule = require('node-schedule');
const mysql = require('mysql');
const tokens = require('./tokens.json');

let con = mysql.createConnection({
	host: tokens.DB_HOST,
	user: tokens.DB_USER,
	password: tokens.DB_PSWD,
	database: tokens.DB_NAME
});

schedule.scheduleJob('0 * * * *', () => {
	console.log('Resetting rated table!');
	con.query('delete from rated');
});

con.connect(function (err) {
	if (err) throw err;
	console.log("Connected to database!");
});

client.on('ready', () => {
	console.log('Ready!');
	client.user.setActivity('Your Social Status', {type: 'WATCHING'});
});

client.on('message', msg => {
	if (msg.content.includes('!rate') && !msg.author.bot) {
		let term = msg.content.substring(msg.content.indexOf('!rate'), msg.content.length);
		let args = term.split(' ');
		if (args.length === 3) {
			let userRated = false;
			if (msg.content.includes(msg.author.id)) {
				msg.reply('You can\'t rate yourself!');
				return;
			}
			if (!msg.content.includes('<@')) {
				msg.reply(`no user specified!\n\`\`\`Example: !rate @${client.user.username} 4.5\`\`\``);
				return;
			}
			if (isNaN(parseFloat(args[2]))) {
				msg.reply(`no rating value found!\n\`\`\`Example: !rate @${client.user.username} 4.5\`\`\``);
				return;
			}
			if (parseFloat(args[2]) <= 0 || parseFloat(args[2]) > 5 || parseFloat(args[2]).toFixed(1) === '0.0') {
				msg.reply(`I only accept values between 0 and 5 (not including 0)\n\`\`\`Example: !rate @${client.user.username} 4.5\`\`\``);
				return;
			}
			if (args[1].includes('!')) {
				args[1] = args[1].substring(args[1].indexOf('!') + 1, args[1].length - 1)
			} else {
				args[1] = args[1].substring(2, args[1].length - 1);
			}
			con.query(`select * from rated where userID='${msg.author.id}' && ratedID='${args[1]}'`, (err, rows, field) => {
				if (err) throw err;
				if (rows.length > 0) {
					msg.reply(`you already rated this user! You can rate them again at the start of the next hour!`);
					userRated = true;
				}
			});
			setTimeout(() => {
				if (!userRated) {
					console.log(`Searching db for ID ${args[1]}`);
					con.query(`select * from users where userID='${args[1]}'`, (err, rows, field) => {
						if (err) throw err;
						args[2] = parseFloat(args[2]) * 1.0;
						let userRated = msg.guild.members.find('id', args[1]);
						if (rows.length === 0) {
							console.log(`User with ID ${args[1]} not found! creating entry`);
							msg.reply(`got it! ${userRated.user} rated **${parseFloat(args[2]).toFixed(1)}**!`);
							if (!userRated.bot) userRated.send(`You have been rated **${args[2].toFixed(1)}** by **${msg.author.tag}**!`);
							if (args[2].toFixed(1) >= 4.0) {
								userRated.addRole(tokens.ROLE_ID);
							} else {
								userRated.removeRole(tokens.ROLE_ID);
							}
							con.query(`insert into users values('${args[1]}', ${parseFloat(args[2]).toFixed(1)}, 1)`);
							con.query(`insert into rated values ('${msg.author.id}', '${args[1]}')`);
						} else if (rows.length === 1) {
							console.log(`User with ID ${args[1]} found! Updating value!`);
							msg.reply(`got it! ${userRated.user} rated **${parseFloat(args[2]).toFixed(1)}**!`)
							let newRating = ((rows[0].curRating * rows[0].numRatings) + parseFloat(args[2])) / (rows[0].numRatings + 1);
							if (!userRated.bot) userRated.send(`You have been rated **${args[2].toFixed(1)}** by **${msg.author.tag}**!`);
							if (newRating >= 4.0) {
								userRated.addRole(tokens.ROLE_ID);
							} else {
								userRated.removeRole(tokens.ROLE_ID);
							}
							con.query(`update users set curRating=${newRating.toFixed(1)}, numRatings=${rows[0].numRatings + 1} where userID='${args[1]}'`);
							con.query(`insert into rated values ('${msg.author.id}', '${args[1]}')`);
						}
					});
				}
			}, 500);
		} else {
			msg.reply(`invalid use of the rate command!\n\`\`\`Example: !rate @${client.user.username} 4.5\`\`\``);
			return;
		}
	} else if (msg.content.includes('!rating') && !msg.author.bot) {
		if (msg.content === '!rating') {
			console.log('User geting own rating');
			con.query(`select * from users where userID='${msg.author.id}'`, (err, rows, field) => {
				if (err) throw err;
				if (rows.length === 0) {
					console.log(`${msg.author.tag} has no rating`)
					msg.reply('you don\'t have any ratings yet!');
				} else {
					if (rows[0].curRating >= 4.0) {
						let guildUser = msg.guild.members.find('id', msg.author.id);
						guildUser.addRole(tokens.ROLE_ID);
					} else {
						let guildUser = msg.guild.members.find('id', msg.author.id);
						guildUser.removeRole(tokens.ROLE_ID);
					}
					console.log(`Sending rating for ${msg.author.tag}`)
					msg.channel.send({
						embed: {
							color: 0xAD2A56,
							author: {
								name: `Rating for ${msg.author.tag}`,
								icon_url: msg.author.avatarURL
							},
							fields: [
								{
									name: 'Rating',
									value: `**${rows[0].curRating}/5**`
								}
							],
							timestamp: new Date(),
							footer: {
								text: `Rated ${rows[0].numRatings} time${rows[0].numRatings > 1 ? 's' : ''}`
							}
						}
					});
				}
			});
		} else if (msg.content.includes('<@')) {
			console.log(`User getting other user's rating`);
			let args = msg.content.split(' ');
			if (args.length !== 2) {
				msg.reply(`Incorrect use of rating command!\n\`\`\`Example: !rating @${client.user.username}\`\`\``);
				return;
			}
			console.log('Args looking correct');
			if (args[1].includes('!')) {
				args[1] = args[1].substring(args[1].indexOf('!') + 1, args[1].length - 1)
			} else {
				args[1] = args[1].substring(2, args[1].length - 1);
			}
			let userSearch = msg.guild.members.find('id', args[1]);
			con.query(`select * from users where userID='${userSearch.user.id}'`, (err, rows, field) => {
				if (err) throw err;
				if (rows.length === 0) {
					console.log(`No rating found for ${userSearch.user.tag}`)
					msg.reply(`${userSearch.user} doesn't have any ratings yet!`);
				} else {
					if (rows[0].curRating >= 4.0) {
						userSearch.addRole(tokens.ROLE_ID);
					} else {
						userSearch.removeRole(tokens.ROLE_ID);
					}
					console.log(`Sending rating for ${userSearch.user.tag}`)
					msg.channel.send({
						embed: {
							color: 0xAD2A56,
							author: {
								name: `Rating for ${userSearch.user.tag}`,
								icon_url: userSearch.user.avatarURL
							},
							fields: [
								{
									name: `Rating`,
									value: `**${rows[0].curRating}/5**`
								}
							],
							timestamp: new Date(),
							footer: {
								text: `Rated ${rows[0].numRatings} time${rows[0].numRatings > 1 ? 's' : ''}`
							}
						}
					});
				}
			});
		}
	}
});

client.login(tokens.BOT_TOKEN);