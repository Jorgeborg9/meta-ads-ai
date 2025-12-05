module.exports = {
  openAiModel: 'gpt-4.1-mini',
  maxWords: 1800,
  baseUrl: 'https://www.insightadsai.com',
  keywordsFile: __dirname + '/keywords.json',
  categoryMap: {
    'meta ads': 'Meta Ads',
    'facebook ads': 'Meta Ads',
    roas: 'Performance',
    attribution: 'Analytics',
  },
}
