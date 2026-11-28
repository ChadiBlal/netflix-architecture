const { Kafka, logLevel } = require('kafkajs');
const config = require('./config');
const kafka = new Kafka({
  clientId: config.kafkaClientId,
  brokers: config.kafkaBrokers,
  logLevel: logLevel.ERROR,
  retry: { initialRetryTime: 300, retries: 8 }
});
const producer = kafka.producer({ allowAutoTopicCreation: true });
let connected = false;
async function connect() {
  await producer.connect();
  connected = true;
  console.log('[kafka] producer connected');
}
async function publish(event) {
  if (!connected) throw new Error('Kafka producer is not connected');
  await producer.send({
    topic: config.kafkaTopic,
    acks: 1,
    messages: [{
      key: event.userId,
      value: JSON.stringify(event),
      timestamp: String(Date.now())
    }]
  });
}
async function disconnect() {
  if (connected) await producer.disconnect();
  connected = false;
}
module.exports = { connect, publish, disconnect, kafka, isConnected: () => connected };
