'use strict';
var express = require('express');
var router = express.Router();
const logger = require('../../common/helpers/log/logger');
const logText = require('../../common/helpers/log/constants');
const { listOfInvestors, saveAllotmentFile, saveCorporateActionRequest, saveCorporateActionRecord, updateSecurities,
    modifyCorporateActionRecord, retrieveMarketLtpData, retrieveCorporateAction, updateRecordChange,
    viewApprovedInfo, updateCorporateRequest, viewCorporateRequest, retrieveCorporateDates,
    updatecorporateActionRecordStatus, fetchRecordsByDate, updatecorporateRequestUploadStatus, fetchUploadedData } = require('../service/corporateActionService')
const { corporateActionValidation, corporateActionRecordValidation } = require('../../validationManager/caValidation');
const constants = require('../../common/util/constants');
const errorConstants = require('../../common/util/errorCode.json');

router.post('/viewCorporateRecord', async (req, res, next) => {
    logger.loggerInstance.trace(__filename, "/viewCorporateRecord", logText.ENTRY_WITH_PARAM, req.body);
    let response = await viewCorporateAction(req.body);
    logger.loggerInstance.trace(__filename, "/viewCorporateRecord", logText.EXIT_WITH_PARAM, response);
    return res.status(response.statusCode).json(response.statusMessage);
})

router.post('/retrieveCorporateActionDetails', async (req, res, next) => {
    logger.loggerInstance.trace(__filename, "/retrieveCorporateActionDetails", logText.ENTRY_WITH_PARAM, req.body);
    let response = await retrieveCorporateAction(req.body);
    logger.loggerInstance.trace(__filename, "/retrieveCorporateActionDetails", logText.EXIT_WITH_PARAM, response);
    return res.status(response.statusCode).json(response.statusMessage);
})
// router.post('/viewUploadDetails', async (req, res, next) => {
//     logger.loggerInstance.trace(__filename, "/viewUploadDetails", logText.ENTRY_WITH_PARAM, req.body);
//     let response = await viewApprovedInfo(req.body);
//     logger.loggerInstance.trace(__filename, "/viewUploadDetails", logText.EXIT_WITH_PARAM, response);
//     return res.status(response.statusCode).json(response.statusMessage);
// })
router.post('/retrieveRecordDateAndEffectiveStartDate', async (req, res, next) => {
    logger.loggerInstance.trace(__filename, "/retrieveRecordDateAndEffectiveStartDate", logText.ENTRY_WITH_PARAM, req.body);
    let response = await retrieveCorporateDates(req.body);
    logger.loggerInstance.trace(__filename, "/retrieveRecordDateAndEffectiveStartDate", logText.EXIT_WITH_PARAM, response);
    return res.status(response.statusCode).json(response.statusMessage);
})


router.post('/record/:actionName', processCorporateActionRecord);
async function processCorporateActionRecord(req, res) {
    logger.loggerInstance.trace(__filename, "/record", logText.ENTRY_WITH_PARAM, req.body);
    const validResp = await corporateActionRecordValidation(req.body);
    let result = {}, statusCode;
    if (validResp.isValid) {
        if (req.body.corporateActionId) {
            let response = await modifyCorporateActionRecord(req.body)
            statusCode = response.statusCode
            result = response.statusMessage
        }
        else {
            let saveCorporateActionResponse = await saveCorporateActionRecord(req.body);
            if (saveCorporateActionResponse && saveCorporateActionResponse.success) {
                result = { success: true };
            } else {
                result = errorConstants.ERR_2600;
            }
            statusCode = saveCorporateActionResponse.statusCode;
        }
    }
    else {
        result = validResp.error;
        statusCode = validResp.statusCode;
    }
    logger.loggerInstance.trace(__filename, "/record", logText.EXIT_WITH_PARAM, result);
    return res.status(statusCode).json(result);
}

router.post('/investorsList', async (req, res, next) => {
    logger.loggerInstance.trace(__filename, "/investorsList", logText.ENTRY_WITH_PARAM, req.body);
    const result = await listOfInvestors(req.body);
    logger.loggerInstance.trace(__filename, "/investorsList", logText.EXIT);
    return res.status(200).json(result);
});

router.post('/upload/:actionName', corporateAction);
async function corporateAction(req, res) {
    logger.loggerInstance.trace(__filename, "/upload", logText.ENTRY_WITH_PARAM, req.body);
    let corporateActionData = req.body;
    corporateActionData.actionName = req.params.actionName;
    let validAllotment = await corporateActionValidation(corporateActionData);
    if (validAllotment.result) {
        try {
            await saveAllotmentFile({ "fileName": corporateActionData.fileName, "fileTypeId": corporateActionData.fileTypeId });
            const output = await saveCorporateActionRequest(corporateActionData);
            logger.loggerInstance.trace(__filename, "/upload", logText.EXIT_WITH_PARAM, output);

            return res.status(output.statusCode).json(output.statusMessage)
        } catch (error) {
            logger.loggerInstance.error(__filename, "/upload", logText.EXIT_WITH_PARAM, error);
            return res.status(constants.STATUS_CODE.UNEXPECTED_ERROR).json({ "statusMessage": errorConstants.ERR_2600 });
        }
    }
    else {
        logger.loggerInstance.error(__filename, "/upload", validAllotment.error);
        return res.status(validAllotment.statusCode).json(validAllotment.error);
    }
}

router.post('/updateSecurities/:actionName', updateSecuritiesAPI);
async function updateSecuritiesAPI(req, res) {
    logger.loggerInstance.trace(__filename, "/updateSecurities", logText.ENTRY_WITH_PARAM, req.body);
    let output = await updateSecurities(req.body);
    logger.loggerInstance.trace(__filename, "/updateSecurities", logText.EXIT_WITH_PARAM, output);
    let response = output.success ? { success: true } : output.error;
    return res.status(output.statusCode).json(response);
}
router.post('/retrieveMarketValue', async (req, res, next) => {
    logger.loggerInstance.trace(__filename, "/retrieveMarketValue", logText.ENTRY_WITH_PARAM, req.body);
    var result = await retrieveMarketLtpData(req.body);
    logger.loggerInstance.trace(__filename, "/retrieveMarketValue", logText.EXIT);
    return res.status(200).json(result);
});
router.post('/reworkRecord', async (req, res, next) => {
    logger.loggerInstance.trace(__filename, "/reworkRecord", logText.ENTRY_WITH_PARAM, req.body);
    let requestData = req.body;
    requestData["corporateActionRecordStatusId"] = constants.CORPORATE_ACTION_RECORD.REWORK;
    let output = await updateRecordChange(requestData);
    logger.loggerInstance.trace(__filename, "/reworkRecord", logText.EXIT_WITH_PARAM, output)
    return res.status(output.statusCode).json(output.statusMessage);
}
);

router.post('/rejectedRecord', async (req, res, next) => {
    logger.loggerInstance.trace(__filename, "/rejectedRecord", logText.ENTRY_WITH_PARAM, req.body);
    let requestData = req.body;
    requestData["corporateActionRecordStatusId"] = constants.CORPORATE_ACTION_RECORD.REJECTED;
    let output = await updateRecordChange(requestData);
    logger.loggerInstance.trace(__filename, "/rejectedRecord", logText.EXIT_WITH_PARAM, output)
    return res.status(output.statusCode).json(output.statusMessage);
}
);

router.post('/approvedRecord', async (req, res, next) => {
    logger.loggerInstance.trace(__filename, "/approvedRecord", logText.ENTRY_WITH_PARAM, req.body);
    let requestData = req.body;
    requestData["corporateActionRecordStatusId"] = constants.CORPORATE_ACTION_RECORD.APPROVED;
    let output = await updateRecordChange(requestData);
    logger.loggerInstance.trace(__filename, "/approvedRecord", logText.EXIT_WITH_PARAM, output)
    return res.status(output.statusCode).json(output.statusMessage);
}
);

router.post('/deleteRecord', async (req, res, next) => {
    logger.loggerInstance.trace(__filename, "/deleteRecord", logText.ENTRY_WITH_PARAM, req.body);
    let requestData = req.body;
    if (requestData.actionType == constants.CORPORATE_ACTION_DETAILS.ACTION_TYPE.DELETION_INITIATED) {
        requestData["corporateActionRecordStatusId"] = constants.CORPORATE_ACTION_RECORD.DELETION_INITIATED;
    }
    else if (requestData.actionType == constants.CORPORATE_ACTION_DETAILS.ACTION_TYPE.DELETION_APPROVED) {
        requestData["corporateActionRecordStatusId"] = constants.CORPORATE_ACTION_RECORD.DELETED;
    }
    else if (requestData.actionType == constants.CORPORATE_ACTION_DETAILS.ACTION_TYPE.DELETION_REJECTED) {
        requestData["corporateActionRecordStatusId"] = constants.CORPORATE_ACTION_RECORD.APPROVED;// if it is rejected,then application shoud be back to approved state
    }
    let output = await updateRecordChange(requestData);
    logger.loggerInstance.trace(__filename, "/deleteRecord", logText.EXIT_WITH_PARAM, output)
    return res.status(output.statusCode).json(output.statusMessage);
}
);

router.post('/approvedRequest', async (req, res, next) => {
    logger.loggerInstance.trace(__filename, "/approvedRequest", logText.ENTRY_WITH_PARAM, req.body);
    let requestData = req.body;
    let uploadStatusParam = {}
    uploadStatusParam.refCorporateRequestUploadStatusId = requestData.refCorporateRequestUploadStatusId
    uploadStatusParam.corporateActionRecordId = requestData.corporateActionRecordId
    delete requestData.refCorporateRequestUploadStatusId
    requestData["corporateActionRecordStatusId"] = constants.CORPORATE_ACTION_RECORD.UPLOAD_APPROVED;
    let output = await updatecorporateActionRecordStatus(requestData);
    let response = await updatecorporateRequestUploadStatus(uploadStatusParam)
    logger.loggerInstance.trace(__filename, "/approvedRequest", logText.EXIT_WITH_PARAM, output)
    return res.status(output.statusCode).json(output.statusMessage);
}
);

router.post('/rejectedRequest', async (req, res, next) => {
    logger.loggerInstance.trace(__filename, "/rejectedRequest", logText.ENTRY_WITH_PARAM, req.body);
    let requestData = req.body;
    let uploadStatusParam = {}
    uploadStatusParam.refCorporateRequestUploadStatusId = requestData.refCorporateRequestUploadStatusId
    uploadStatusParam.corporateActionRecordId = requestData.corporateActionRecordId
    delete requestData.refCorporateRequestUploadStatusId
    requestData["corporateActionRecordStatusId"] = constants.CORPORATE_ACTION_RECORD.UPLOAD_REJECTED;
    let output = await updatecorporateActionRecordStatus(requestData);
    let response = await updatecorporateRequestUploadStatus(uploadStatusParam)
    logger.loggerInstance.trace(__filename, "/rejectedRequest", logText.EXIT_WITH_PARAM, output)
    return res.status(output.statusCode).json(output.statusMessage);
}
);

router.post('/deleteRequest', async (req, res, next) => {
    logger.loggerInstance.trace(__filename, "/deleteRequest", logText.ENTRY_WITH_PARAM, req.body);
    let requestData = req.body;
    let uploadStatusParam = {}
    if (requestData.actionType == constants.CORPORATE_ACTION_DETAILS.ACTION_TYPE.DELETION_INITIATED) {
        requestData["corporateActionRecordStatusId"] = constants.CORPORATE_ACTION_RECORD.UPLOAD_DELETION_INITIATED;
    }
    else if (requestData.actionType == constants.CORPORATE_ACTION_DETAILS.ACTION_TYPE.DELETION_APPROVED) {
        requestData["corporateActionRecordStatusId"] = constants.CORPORATE_ACTION_RECORD.UPLOAD_DELETION_APPROVED;

        uploadStatusParam.refCorporateRequestUploadStatusId = requestData.refCorporateRequestUploadStatusId
        uploadStatusParam.corporateActionRecordId = requestData.corporateActionRecordId
        delete requestData.refCorporateRequestUploadStatusId
    }
    let output = await updatecorporateActionRecordStatus(requestData);
    let response = await updatecorporateRequestUploadStatus(uploadStatusParam)
    logger.loggerInstance.trace(__filename, "/deleteRequest", logText.EXIT_WITH_PARAM, output)
    return res.status(output.statusCode).json(output.statusMessage);
}
);

// router.post('/viewCorporateRequestDetails', async (req, res, next) => {
//     logger.loggerInstance.trace(__filename, "/viewCorporateRequestDetails", logText.ENTRY_WITH_PARAM, req.body);
//     let response = await viewCorporateRequest(req.body);
//     logger.loggerInstance.trace(__filename, "/viewCorporateRequestDetails", logText.EXIT_WITH_PARAM, response);
//     return res.status(response.statusCode).json(response.statusMessage);
// })
router.post('/fetchRecordsByDate', async (req, res, next) => {
    logger.loggerInstance.trace(__filename, "/fetchRecordsByDate", logText.ENTRY_WITH_PARAM, req.body);
    let response = await fetchRecordsByDate(req.body);
    logger.loggerInstance.trace(__filename, "/fetchRecordsByDate", logText.EXIT_WITH_PARAM, response);
    return res.status(response.statusCode).json(response.statusMessage);
})

router.post('/retrieveUploadedData', async (req, res, next) => {
    logger.loggerInstance.trace(__filename, "/retrieveUploadedData", logText.ENTRY_WITH_PARAM, req.body);
    let requestData = req.body;
    let response = await fetchUploadedData(requestData);
    logger.loggerInstance.trace(__filename, "/retrieveUploadedData", logText.EXIT_WITH_PARAM, response)
    return res.status(response.statusCode).json(response.statusMessage);
}
);

module.exports = router;