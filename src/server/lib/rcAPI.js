const axios = require('axios');

const getUserInfo = async (userId, accessToken) => {
    const response = await axios.get(`${process.env.RINGCENTRAL_SERVER}/restapi/v1.0/glip/persons/${userId}`, {
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`
        }
    });

    return response.data;
}

const getGroupInfo = async (groupId, accessToken) => {
    const response = await axios.get(`${process.env.RINGCENTRAL_SERVER}/restapi/v1.0/glip/groups/${groupId}`, {
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`
        }
    });

    return response.data;
}

const createConversation = async (userIds, accessToken) => {
    const members = userIds.map(function (id) { return { id } });
    const postBody = {
        members
    };
    const response = await axios.post(`${process.env.RINGCENTRAL_SERVER}/restapi/v1.0/glip/conversations`,
        postBody,
        {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`
            }
        });

    return response.data;
}

exports.getUserInfo = getUserInfo;
exports.getGroupInfo = getGroupInfo;
exports.createConversation = createConversation;