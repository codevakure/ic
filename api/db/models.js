const mongoose = require('mongoose');
const { createModels } = require('@ranger/data-schemas');
const models = createModels(mongoose);

module.exports = { ...models };
