const SMTPServer = require('smtp-server').SMTPServer;
const simpleParser = require('mailparser').simpleParser;
const previewEmail = require('preview-email');
const pino = require('pino');
const yargs = require('yargs');

const pretty = pino.pretty();
pretty.pipe(process.stdout)
const logger = pino({
	name: 'smtp-tester',
	safe: true
}, pretty);

const server = new SMTPServer({
	disabledCommands: [ 'AUTH', 'STARTTLS' ],

	onAuth(auth, session, callback) {
		callback(null);
	},

	onMailFrom(address, session, callback) {
		callback(null);
	},

	onData(stream, session, callback) {
		const chunks = [];

		stream.on('data', buffer => {
			chunks.push(buffer);
		});

		stream.on('error', err => {
			logger.error('Error while recieve email', err);
		})

		stream.on('end', () => {
			const data = Buffer.concat(chunks).toString().replace(/\r\n$/, '');
			logger.info('Email recieved successfully');

			simpleParser(data)
				.then(mail => {
					logger.info(`Email ${mail.subject} from ${mail.from.text} to ${ mail.to.text} parsed`);
					return previewEmail({
						from: mail.from.text,
						to: mail.to.text,
						subject: mail.subject,
						html: mail.html,
						text: mail.text,
					})
				})
				.then(() => {
					logger.info('Email recieve finished');
					callback(null);
				})
				.catch(err => {
					logger.error('Error while parsing email', err);
					callback(err);
				});
		});
	}
});

server.on('error', err => {
    logger.error('SMTP server error', err);
});


let args = ['--port'];
if (process.env.npm_config_argv) {
	args = args.concat(JSON.parse(process.env.npm_config_argv).remain);
}
const argv = yargs(args).argv;
let port;
if (Number.isInteger(argv.port)) {
	port = argv.port;
} else if (process.env.npm_package_config_port) {
	port = process.env.npm_package_config_port;
} else {
	port = 32284
}

server.listen(port, err => {
	if (err) {
		logger.error('Error while starting SMTP server', err);
	} else {
		logger.info(`SMTP server started successfully on port ${port}`);
	}
});
