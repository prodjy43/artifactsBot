const axios = require('axios');
const {API_BASE_URL} = require('./constants')

//General API call function to be used by prototypes and other game logic
const gameAPI = {
    callAPI : async function (endpoint, method, headers = {}, data = null,params=null) {
        const options = {
            method: method,
            url: `${API_BASE_URL}${endpoint}`,
            headers: {
                'Content-Type': 'application/json',
                Accept: 'application/json',
                ...headers
            },
            data: data,
            params:params
        };
    
        try {
            const response = await axios.request(options);
            //Check for paginated response and gather the rest of the data if needed
            if (response.data && response.data.pages && response.data.page) {
                let allData = response.data.data;
                let currentPage = response.data.page;
                const totalPages = response.data.pages;
    
                while (currentPage < totalPages) {
                    currentPage++;
                    const paginatedParams = { ...params, page: currentPage };
                    const paginatedResponse = await axios.request({ ...options, params: paginatedParams });
                    allData = allData.concat(paginatedResponse.data.data);
                }
    
                return { ...response.data, data: allData };
            }
    
            return response.data;
        } catch (error) {
            console.error('API call failed:', error);
            throw error;
        }
    }
}

module.exports = gameAPI;