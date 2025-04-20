// netlify/functions/twitter-proxy.js
const fetch = require('node-fetch');

exports.handler = async (event) => {
  // Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Get hashtag from query parameters
  const { query } = event.queryStringParameters;
  if (!query) {
    return { statusCode: 400, body: 'Missing query parameter' };
  }

  try {
    const response = await fetch(`https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&tweet.fields=created_at&expansions=author_id&user.fields=name,username,profile_image_url`, {
      headers: {
        'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
      }
    });

    if (!response.ok) {
      throw new Error(`Twitter API error: ${response.status}`);
    }

    const data = await response.json();
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*' // Enable CORS
      },
      body: JSON.stringify(data)
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};