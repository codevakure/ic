const manifest = require('./manifest');

// Structured Tools
const DALLE3 = require('./structured/DALLE3');
const FluxAPI = require('./structured/FluxAPI');
const OpenWeather = require('./structured/OpenWeather');
const StructuredWolfram = require('./structured/Wolfram');
const createYouTubeTools = require('./structured/YouTube');
const createYouTubeVideoLoaderTools = require('./structured/YouTubeVideoLoader');
const StructuredACS = require('./structured/AzureAISearch');
const StructuredSD = require('./structured/StableDiffusion');
const GoogleSearchAPI = require('./structured/GoogleSearch');
const TraversaalSearch = require('./structured/TraversaalSearch');
const createOpenAIImageTools = require('./structured/OpenAIImageTools');
const TavilySearchResults = require('./structured/TavilySearchResults');
const PostgreSQL = require('./structured/PostgreSQL');
const BedrockKnowledgeBase = require('./structured/BedrockKnowledgeBase');
const SnowflakeDatabase = require('./structured/SnowflakeDatabase');
const SnowflakeCreditRiskAnalyst = require('./structured/SnowflakeCreditRiskAnalyst');
const SnowflakeFinancialAnalyst = require('./structured/SnowflakeFinancialAnalyst');

module.exports = {
  ...manifest,
  // Structured Tools
  DALLE3,
  FluxAPI,
  OpenWeather,
  StructuredSD,
  StructuredACS,
  GoogleSearchAPI,
  TraversaalSearch,
  StructuredWolfram,
  createYouTubeTools,
  createYouTubeVideoLoaderTools,
  TavilySearchResults,
  createOpenAIImageTools,
  PostgreSQL,
  BedrockKnowledgeBase,
  SnowflakeDatabase,
  SnowflakeCreditRiskAnalyst,
  SnowflakeFinancialAnalyst,
};
