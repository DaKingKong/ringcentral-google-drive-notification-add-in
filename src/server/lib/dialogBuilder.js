function getIframeDialog({ title, size, iconURL, iframeURL }) {
    const dialog = {
        ...(size !== null && { size }),
        ...(iconURL !== null && { iconURL }),
        ...title, iframeURL
    };

    return dialog;
}

exports.getIframeDialog = getIframeDialog;