const axios = require('axios');
const API_BASE_URL = 'https://api.artifactsmmo.com';

//General API call function to be used by prototypes and other game logic
async function callAPI(endpoint, method, headers = {}, data = null) {
    const options = {
        method: method,
        url: `${API_BASE_URL}${endpoint}`,
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...headers
        },
        data: data
    };

    try {
        const response = await axios.request(options);
        console.log(response.data);
        return response.data;
    } catch (error) {
        console.error('API call failed:', error);
        throw error;
    }
}

module.exports = { callAPI };