const { removeNullishValues } = require('librechat-data-provider');
const generateArtifactsPrompt = require('~/app/clients/prompts/artifacts');

const buildOptions = (endpoint, parsedBody) => {
  const {
    modelLabel: name,
    promptPrefix,
    maxContextTokens,
    fileTokenLimit,
    resendFiles = true,
    imageDetail,
    iconURL,
    greeting,
    spec,
    artifacts,
    model,
    ...model_parameters
  } = parsedBody;
  
  // Re-add model to model_parameters if it was destructured
  if (model) {
    model_parameters.model = model;
  }
  
  const endpointOption = removeNullishValues({
    endpoint,
    name,
    resendFiles,
    imageDetail,
    iconURL,
    greeting,
    spec,
    promptPrefix,
    maxContextTokens,
    fileTokenLimit,
    model_parameters,
  });

  if (typeof artifacts === 'string') {
    endpointOption.artifactsPrompt = generateArtifactsPrompt({ endpoint, artifacts, model });
  }

  return endpointOption;
};

module.exports = { buildOptions };
