const logger = require('../../common/helpers/log/logger');
const logText = require('../../common/helpers/log/constants');
const { getCurrentDateOnly, getConvertDate } = require('../../common/util/dateHandler');
const { saveAllotmentFileName } = require('../../allotmentManager/dao/allotmentDao')
const constants = require('../../common/util/constants');
const { dbInstance } = require('../../common/helpers/db');
const errorConstants = require('../../common/util/errorCode.json');
const { corporateActionDao, createCorporateActionRecord, listOfInvestorsDao, getCorporateRequestDetails,
    updateCorporateActionRecord, reformCorporateActionRecord, retrieveMarketLtpDataDao, corporateActionDetail,
    updateRecordChangeRequest, approvedDetailDAO, updateCorporateRequestDao, viewCorporateRequestDetails,
    corporateActionDates, updatecorporateActionRecordStatusData, getCorpActionFetchByDate, getSecurityMasterId,
    retrieveMarketClosePrice, updateCorporateRequestUploadStatusData, getDpAcctInfo, updateSecurityMasterStatus,
    retreiveCorporateRequestDetails, retrieveCaRecordDetails, getUserBankAccountDetails } = require('../dao/corporateActionDao');
const { saveHoldings } = require("../../securityManager/dao/securityHoldingsDao");
const { saveCorporateActionLedger } = require("../../securityManager/dao/ledger/ledgerDao");
const { getMakerCheckerData } = require('../../common/util/commonFunctions')
const { checkValid } = require('../../validationManager/fieldValidator');
const ApiException = require('../../exceptionManager/services/ApiException');
const { securityStatusChangePublisher } = require('../producers/corporateActionProducer');
const { CORPORATE_REQUEST_UPLOAD_STATUS, NULL_VALUE, CA_ACTION_TYPE, BOOLEAN } = require('../../common/util/constants');
const { initiateBulkPaymentRequest } = require('./bulkPaymentService');
const { retrieveSecurityMasterDetails } = require('../../sharedManager/controller/sharedController')
const retrieveCorporateAction = async (data) => {
    logger.loggerInstance.trace(__filename, "retrieCorporateAction", logText.ENTRY_WITH_PARAM, data);
    let response = await corporateActionDetail(data);
    if (response && response.errorCode) {
        logger.loggerInstance.trace(__filename, "retrieveCorporateAction", logText.EXIT);
        return { "statusCode": constants.STATUS_CODE.DB_ORM_ERROR, "statusMessage": response }
    }
    if (data.actionType == CA_ACTION_TYPE.UPLOAD) {
        let uploadData = []
        let fetchData = response[0]
        let uploadRequestData = {}
        uploadRequestData.securityMasterId = fetchData.securityMasterId
        uploadRequestData.refCorporateActionId = fetchData.corporateActionTypeId
        uploadRequestData.recordDate = fetchData.recordDate
        uploadRequestData.corporateActionRecordId = data.corporateActionId
        let uploadResponse = await fetchUploadedData(uploadRequestData)
        if (uploadResponse.statusCode == constants.STATUS_CODE.DB_ORM_ERROR) {
            logger.loggerInstance.trace(__filename, "retrieveCorporateAction", logText.EXIT);
            return { "statusCode": constants.STATUS_CODE.DB_ORM_ERROR, "statusMessage": uploadResponse }
        }
        let responseData = uploadResponse.statusMessage
        Object.keys(responseData).forEach(key => uploadData.push(responseData[key]));
        // Working Logic
        // let requestInvestorData = {};
        // requestInvestorData.securityMasterId = fetchData.securityMasterId;
        // requestInvestorData.corporateActionTypeId = parseInt(fetchData.corporateActionTypeId);
        // requestInvestorData.recordDate = fetchData.recordDate;
        // let investorData = await listOfInvestors(requestInvestorData)
        // uploadData.map((value, index) => {
        //     if (uploadData[index].dpAcctId) {
        //         uploadData[index] = { ...value, ...investorData[index] }
        //     } else {
        // let commonColumnData = []
        // commonColumnData.serialNumber = investorData.length + 1
        // commonColumnData.assetDescription = investorData[index - 1].assetDescription
        // commonColumnData.secTypeDescription = investorData[index - 1].secTypeDescription
        // commonColumnData.securityName = investorData[index - 1].securityName
        //         uploadData[index] = { ...uploadData[index], ...commonColumnData }
        //     }
        // })
        let closePriceParam = {}
        closePriceParam.securityMasterId = fetchData.securityMasterId
        closePriceParam.recordDate = fetchData.recordDate
        let marketClosePrice = await retrieveMarketClosePriceData(closePriceParam)
        let recordDetailsParam = {}
        recordDetailsParam.corporateActionRecordId = data.corporateActionId
        let recordDetails = await retrieveCaRecordDetails(recordDetailsParam)
        uploadData.map((value, index) => {
            if (uploadData[index].dpAcctId) {
                uploadData[index].recordDateClosingPrice = (marketClosePrice && marketClosePrice.closePrice) ? marketClosePrice.closePrice : ""
            } else {
                value.recordDate = ""
                value.currentHolding = ""
            }
            uploadData[index].serialNumber = index + 1
            uploadData[index] = { ...value, ...recordDetails }
        })
        let finalResponse = {}
        finalResponse.corporateActionTypeId = fetchData.corporateActionTypeId
        finalResponse.data = uploadData
        finalResponse.fetchData = fetchData
        logger.loggerInstance.trace(__filename, "retrieveCorporateAction", logText.EXIT_WITH_PARAM, finalResponse);
        return { "statusCode": constants.STATUS_CODE.SUCCESS, "statusMessage": finalResponse };
    }
    logger.loggerInstance.trace(__filename, "retrieveCorporateAction", logText.EXIT_WITH_PARAM, response);
    return { "statusCode": constants.STATUS_CODE.SUCCESS, "statusMessage": response };
}
// const viewApprovedInfo = async (data) => {
//     logger.loggerInstance.trace(__filename, "viewApprovedInfo", logText.ENTRY_WITH_PARAM, data);
//     let response = await approvedDetailDAO(data);
//     if (response && response.errorCode) {

//         logger.loggerInstance.trace(__filename, "viewApprovedInfo", logText.EXIT);
//         return { "statusCode": constants.STATUS_CODE.DB_ORM_ERROR, "statusMessage": response }
//     }
//     logger.loggerInstance.trace(__filename, "viewApprovedInfo", logText.EXIT_WITH_PARAM, response);
//     return { "statusCode": constants.STATUS_CODE.SUCCESS, "statusMessage": response };
// }
const retrieveCorporateDates = async (data) => {
    logger.loggerInstance.trace(__filename, "retrieveCorporateDates", logText.ENTRY_WITH_PARAM, data);
    let response = await corporateActionDates(data);
    if (response && response.errorCode) {
        logger.loggerInstance.trace(__filename, "retrieveCorporateDates", logText.EXIT);
        return { "statusCode": constants.STATUS_CODE.DB_ORM_ERROR, "statusMessage": response }
    }
    logger.loggerInstance.trace(__filename, "retrieveCorporateDates", logText.EXIT_WITH_PARAM, response);
    return { "statusCode": constants.STATUS_CODE.SUCCESS, "statusMessage": response };
}

const listOfInvestors = async (data) => {
    logger.loggerInstance.trace(__filename, "listOfInvestors", logText.ENTRY_WITH_PARAM, data);
    const response = await listOfInvestorsDao(data);
    let closePriceParam = {}
    closePriceParam.recordDate = data.recordDate
    closePriceParam.securityMasterId = data.securityMasterId
    const marketClosePrice = await retrieveMarketClosePrice(closePriceParam)
    response.map((value, index) => {
        value.recordDateClosingPrice = marketClosePrice ? marketClosePrice.closePrice : constants.NULL_VALUE.NULL
    })
    const investorsList = response;
    logger.loggerInstance.trace(__filename, "listOfInvestors", logText.EXIT_WITH_PARAM, investorsList);
    return investorsList;
}

const retrieveMarketClosePriceData = async (data) => {
    logger.loggerInstance.trace(__filename, "retrieveMarketClosePriceData", logText.ENTRY_WITH_PARAM, data);
    let closePriceParam = {}
    closePriceParam.recordDate = data.recordDate
    closePriceParam.securityMasterId = data.securityMasterId
    const response = await retrieveMarketClosePrice(closePriceParam)
    if (response && response.errorCode) {
        logger.loggerInstance.trace(__filename, "retrieveMarketClosePriceData", logText.EXIT);
        return { "statusCode": constants.STATUS_CODE.DB_ORM_ERROR, "statusMessage": response }
    }
    logger.loggerInstance.trace(__filename, "retrieveMarketClosePriceData", logText.EXIT_WITH_PARAM, response);
    return response ? response : constants.NULL_VALUE.NULL;
}

const saveAllotmentFile = async (data) => {
    logger.loggerInstance.trace(__filename, "saveAllotmentFile", logText.ENTRY_WITH_PARAM, data);
    const response = await saveAllotmentFileName(data);
    logger.loggerInstance.trace(__filename, "saveAllotmentFile", logText.EXIT);
    return { "statusCode": constants.STATUS_CODE.SUCCESS, "statusMessage": response };
}

const saveCorporateActionRequest = async (data) => {
    logger.loggerInstance.trace(__filename, "saveCorporateActionRequest", logText.ENTRY_WITH_PARAM, data);
    try {

        let response;
        let corporateActionTxn = await dbInstance.transaction();

        response = await corporateActionDao(data, corporateActionTxn);
        corporateActionTxn.commit();

        let caRecord = {};
        caRecord.paramsToUpdate = {
            corporateActionRecordStatusId: constants.CORPORATE_ACTION_RECORD.UPLOAD_CREATED,
            corporateActionStatusId: constants.CORPORATE_ACTION_DETAILS.STATUS_ID.UPLOADED,
            effectiveStartDate: getConvertDate(data.effectiveStartDate)
        };

        //where condition securityMasterId, corporateActionTypeId, recordDate
        caRecord.filterParams = {
            securityMasterId: data.securityMasterId,
            refCorporateActionId: data.corporateActionTypeId,
            recordDate: getConvertDate(data.recordDate)
        };
        await updateCorporateActionRecord(caRecord);

        logger.loggerInstance.trace(__filename, "saveCorporateActionRequest", logText.EXIT_WITH_PARAM, response);
        return { "statusCode": constants.STATUS_CODE.SUCCESS, "statusMessage": response };
    } catch (error) {
        logger.loggerInstance.error(__filename, "saveCorporateActionRequest", logText.EXIT_WITH_PARAM, error);
        return { "statusCode": constants.STATUS_CODE.UNEXPECTED_ERROR, "statusMessage": errorConstants.ERR_2600 };
    }
}

const saveCorporateActionRecord = async (data) => {

    logger.loggerInstance.trace(__filename, "saveCorporateActionRecord", logText.ENTRY_WITH_PARAM, data);
    data.refCorporateActionId = data.corporateActionTypeId;
    data.corporateActionStatusId = constants.CORPORATE_ACTION_DETAILS.STATUS_ID.CREATED;
    data.corporateActionRecordStatusId = constants.CORPORATE_ACTION_RECORD.VERIFIED;
    let adminId = await getMakerCheckerData(data)
    data = { ...data, ...adminId }
    //insert into corporate_action table
    let createCaRecordResponse = await createCorporateActionRecord(data);
    let result = null;

    if (createCaRecordResponse && createCaRecordResponse.corporateActionId && createCaRecordResponse.corporateActionId > 0) {
        result = { success: true, statusCode: constants.STATUS_CODE.SUCCESS };
    } else {
        if (createCaRecordResponse && createCaRecordResponse.error) {
            result = { success: false, statusCode: constants.STATUS_CODE.UNEXPECTED_ERROR, error: createCaRecordResponse.error };
        }
        else {
            result = { success: false, statusCode: constants.STATUS_CODE.UNEXPECTED_ERROR, error: errorConstants.ERR_2600 };
        }
    }
    logger.loggerInstance.trace(__filename, "saveCorporateActionRecord", logText.EXIT_WITH_PARAM, result);
    return result;

}

const buildCorporateActionData = async (data) => {
    logger.loggerInstance.trace(__filename, "buildCorporateActionData", logText.ENTRY_WITH_PARAM, data);
    try {
        let sequelizeTxn = await dbInstance.transaction();
        let response;
        let result = [];
        for (let caData of data) {
            response = await updateSecurities(caData);
            result.push(response);
            await processNextStep(caData);
            let caRecord = {};
            caRecord.paramsToUpdate = {
                corporateActionStatusId: constants.CORPORATE_ACTION_DETAILS.STATUS_ID.ACTION_COMPLETED
            };
            caRecord.filterParams = {
                corporateActionId: caData.corporateActionRecordId
            };
            await updateCorporateActionRecord(caRecord);
        }
        for (let idxResult of result) {
            if (idxResult.error) {
                logger.loggerInstance.error(__filename, "buildCorporateActionData", idxResult);
                logger.loggerInstance.trace(__filename, "buildCorporateActionData", logText.EXIT);
                return 0
            }
        }
        sequelizeTxn.commit();
        logger.loggerInstance.trace(__filename, "buildCorporateActionData", logText.EXIT);
    } catch (error) {
        logger.loggerInstance.error(__filename, "buildCorporateActionData - Catch Block", error);
    }
}
const updateSecurities = async (data, sequelizeTxn) => {
    logger.loggerInstance.trace(__filename, "updateSecurities", logText.ENTRY_WITH_PARAM, data);
    let caSpecificConfig = constants.CORPORATE_ACTION_DETAILS[data.refCorporateActionId];
    let result = null;
    //Check if updating securities is allowed in this corporate action
    if (caSpecificConfig.securityHoldings) {
        let corporateActionAllotmentRequests = await getCorporateRequestDetails(data);
        if (corporateActionAllotmentRequests == null || Object.entries(corporateActionAllotmentRequests).length == 0) {
            result = { statusCode: constants.STATUS_CODE.VALIDATION_ERROR, error: errorConstants.ERR_2522 };
        }
        else {
            //let sequelizeTxn = await dbInstance.transaction();
            try {
                for (let [corporateReqId, corporateReqData] of Object.entries(corporateActionAllotmentRequests)) {
                    let ledgerSequenceList = caSpecificConfig.ledgerSequenceList
                    for (let index in ledgerSequenceList) {
                        let securityMasterId, side, ledgerAction
                        side = caSpecificConfig[ledgerSequenceList[index]].side
                        ledgerAction = caSpecificConfig.ledgerSequenceList[index]
                        if (caSpecificConfig[ledgerSequenceList[index]].securityAttribute) {
                            let newsecuritySymbol = caSpecificConfig[ledgerSequenceList[index]].securityAttribute
                            securityMasterId = await getSecurityMasterId({ securitySymbol: corporateReqData[newsecuritySymbol] })
                        }
                        else {
                            securityMasterId = data.securityMasterId
                        }
                        //Populate caSpecificDetails based on configuration
                        let caSpecificDetails = {};
                        caSpecificDetails.side = side;
                        if (caSpecificConfig[ledgerSequenceList[index]].qtyReference) {
                            caSpecificDetails.qty = corporateReqData[caSpecificConfig[ledgerSequenceList[index]].qtyReference]
                        }
                        else {
                            caSpecificDetails.qty = corporateReqData[caSpecificConfig.qtyColumnReference];
                        }
                        caSpecificDetails.narrationText = caSpecificConfig.narrationText;

                        if (caSpecificConfig[ledgerSequenceList[index]].isSuspenseAccount && corporateReqData.splSuspenseDpAcctNo) {
                            let splDpAccountDetails = await getDpAcctInfo({ "depositoryAccountNumber": corporateReqData.splSuspenseDpAcctNo });
                            if (splDpAccountDetails && splDpAccountDetails.dpAcctId) {
                                caSpecificValidResp = true;
                                corporateReqData.dpAcctId = splDpAccountDetails.dpAcctId
                            } else {
                                logger.loggerInstance.error(__filename, "updateSecurities - Invalid suspense account DP number", corporateReqData);
                                throw new Error("Unknown DP Account Number")
                            }
                        } else if (caSpecificConfig[ledgerSequenceList[index]].isSuspenseAccount === BOOLEAN.FALSE && corporateReqData.splSuspenseDpAcctNo && !(corporateReqData.dpAcctId)) {
                            logger.loggerInstance.info(__filename, "updateSecurities- CorporateReqData: ", corporateReqData);
                            continue;
                        }

                        //Params for transaction table
                        let transactionParams = {};

                        transactionParams.dpAcctId = corporateReqData.dpAcctId;
                        transactionParams.txnRefNo = corporateReqId;
                        transactionParams.narration = caSpecificDetails.narrationText;
                        transactionParams.txnTypeId = caSpecificConfig.txnType;
                        transactionParams.transactionDetails = 'FROM:CORPORATE TO:' + corporateReqData.dpAcctId + ' /FREE SECURITY:'
                            + securityMasterId + ' QTY:' + caSpecificDetails.qty;
                        //Params for ledger table
                        let ledgerParams = {};
                        ledgerParams.dpAcctId = corporateReqData.dpAcctId;
                        ledgerParams.securityMasterId = securityMasterId;
                        ledgerParams.positionLabel = constants.POSITION_LABEL.FREE;
                        ledgerParams.positionLabelId = constants.POSITION_LABEL_ID.FREE;
                        if (ledgerAction == constants.CORPORATE_ACTION_LEDGER.CREDIT) {
                            ledgerParams.credit = caSpecificDetails.qty
                        }
                        if (ledgerAction == constants.CORPORATE_ACTION_LEDGER.DEBIT) {
                            ledgerParams.debit = caSpecificDetails.qty
                        }
                        ledgerParams.side = side;

                        //Save to transaction and ledger tables
                        await saveCorporateActionLedger(transactionParams, ledgerParams, sequelizeTxn);

                        let holdingParams = {};
                        holdingParams.dpAcctId = corporateReqData.dpAcctId;
                        holdingParams.side = side;// need to check with vijay
                        holdingParams.qty = caSpecificDetails.qty;
                        holdingParams.securityMasterId = securityMasterId;
                        //holdingParams.quantity = 0; //Tested but Need to confirm and remove
                        holdingParams.price = 0;
                        holdingParams.amountInvested = 0;
                        holdingParams.avgPrice = 0;
                        holdingParams.refCAId = data.refCorporateActionId
                        holdingParams.actionType = ledgerAction
                        //save to holdings table
                        await saveHoldings(holdingParams, sequelizeTxn);
                    }
                }

                // sequelizeTxn.commit();
                result = { statusCode: constants.STATUS_CODE.SUCCESS, success: true };
            } catch (error) {
                logger.loggerInstance.error(__filename, "updateSecurities", error);
                if (sequelizeTxn && !sequelizeTxn.finished)
                    sequelizeTxn.rollback();
                result = { statusCode: constants.STATUS_CODE.UNEXPECTED_ERROR, error: errorConstants.ERR_2600 }
            }
        }
    } else {
        result = { statusCode: constants.STATUS_CODE.VALIDATION_ERROR, error: errorConstants.ERR_2523 }
    }

    logger.loggerInstance.trace(__filename, "updateSecurities", logText.EXIT_WITH_PARAM, result);
    return result;

}

const modifyCorporateActionRecord = async (data) => {
    logger.loggerInstance.trace(__filename, "modifyCorporateActionRecord", logText.ENTRY_WITH_PARAM, data);
    let adminId = await getMakerCheckerData(data)
    data = { ...data, ...adminId }
    let response = await reformCorporateActionRecord(data)
    if (response && response.errorCode) {
        logger.loggerInstance.trace(__filename, "modifyCorporateActionRecord", logText.EXIT_WITH_PARAM, response);
        return { "statusCode": constants.STATUS_CODE.DB_ORM_ERROR, "statusMessage": response }
    }
    else {
        logger.loggerInstance.trace(__filename, "modifyCorporateActionRecord", logText.EXIT_WITH_PARAM, response);
        return { "statusCode": constants.STATUS_CODE.SUCCESS, "statusMessage": { success: true } };
    }
}
const updateRecordChange = async (data) => {
    logger.loggerInstance.trace(__filename, "updateRecordChange", logText.ENTRY_WITH_PARAM, data);
    let response = await updateRecordChangeRequest(data);
    if (response && response.errorCode) {
        logger.loggerInstance.trace(__filename, "updateRecordChange", logText.EXIT);
        return { "statusCode": constants.STATUS_CODE.DB_ORM_ERROR, "statusMessage": response }
    }
    logger.loggerInstance.trace(__filename, "updateRecordChange", logText.EXIT);
    return { "statusCode": constants.STATUS_CODE.SUCCESS, "statusMessage": { "corporateActionId": response } };
}
const retrieveMarketLtpData = async (data) => {
    logger.loggerInstance.trace(__filename, "retrieveMarketLtpData", logText.ENTRY_WITH_PARAM, data);
    const response = await retrieveMarketLtpDataDao(data);
    logger.loggerInstance.trace(__filename, "retrieveMarketLtpData", logText.EXIT, response);
    return response
}
// const updateCorporateRequest = async (data) => {
//     logger.loggerInstance.trace(__filename, "updateCorporateRequest", logText.ENTRY_WITH_PARAM, data);
//     let response = await updateCorporateRequestDao(data);
//     if (response && response.errorCode) {
//         logger.loggerInstance.trace(__filename, "updateCorporateRequest", logText.EXIT);
//         return { "statusCode": constants.STATUS_CODE.DB_ORM_ERROR, "statusMessage": response }
//     }
//     logger.loggerInstance.trace(__filename, "updateCorporateRequest", logText.EXIT);
//     return { "statusCode": constants.STATUS_CODE.SUCCESS, "statusMessage": { "corporateReqId": response } };
// }
// const viewCorporateRequest = async (data) => {
//     logger.loggerInstance.trace(__filename, "viewCorporateRequest", logText.ENTRY_WITH_PARAM, data);
//     const response = await viewCorporateRequestDetails(data);
//     logger.loggerInstance.trace(__filename, "viewCorporateRequest", logText.EXIT_WITH_PARAM, response);
//     return { "statusCode": constants.STATUS_CODE.SUCCESS, "statusMessage": response };

// }
const updatecorporateActionRecordStatus = async (data) => {
    logger.loggerInstance.trace(__filename, "updatecorporateActionRecordStatus", logText.ENTRY_WITH_PARAM, data);
    let response = await updatecorporateActionRecordStatusData(data);
    if (response && response.errorCode) {
        logger.loggerInstance.trace(__filename, "updatecorporateActionRecordStatus", logText.EXIT);
        return { "statusCode": constants.STATUS_CODE.DB_ORM_ERROR, "statusMessage": response }
    }
    logger.loggerInstance.trace(__filename, "updatecorporateActionRecordStatus", logText.EXIT);
    return { "statusCode": constants.STATUS_CODE.SUCCESS, "statusMessage": { response } };
}

const updatecorporateRequestUploadStatus = async (data) => {
    logger.loggerInstance.trace(__filename, "updatecorporateRequestUploadStatus", logText.ENTRY_WITH_PARAM, data);
    let response = await updateCorporateRequestUploadStatusData(data);
    if (response && response.errorCode) {
        logger.loggerInstance.trace(__filename, "updatecorporateRequestUploadStatus", logText.EXIT);
        return { "statusCode": constants.STATUS_CODE.DB_ORM_ERROR, "statusMessage": response }
    }
    logger.loggerInstance.trace(__filename, "updatecorporateRequestUploadStatus", logText.EXIT);
    return { "statusCode": constants.STATUS_CODE.SUCCESS, "statusMessage": response };
}

const formatRecordsByDateResponse = (corporateRequestDetail) => {
    let corpReferenceDetails = {};
    corpReferenceDetails.assetClass = corporateRequestDetail.security_master.refSec.refAs.description;
    corpReferenceDetails.securitySymbol = corporateRequestDetail.security_master.refSec.description;
    corpReferenceDetails.investorName = corporateRequestDetail.investorName;
    corpReferenceDetails.depositoryAccountNumber = corporateRequestDetail.dpAccountId;
    corpReferenceDetails.depositoryAccountStatus = corporateRequestDetail.dpAccountStatus;
    corpReferenceDetails.currentHoldings = corporateRequestDetail.currentHolding;
    corpReferenceDetails.recordDate = corporateRequestDetail.recordDate;
    corpReferenceDetails.recordDateClosingPrice = corporateRequestDetail.recordDtClosingPrice;
    corpReferenceDetails.referenceColumnDetails = corporateRequestDetail.corporate_request_details.map(referenceDetails => {
        var referenceDetail = {};
        referenceDetail.columnName = referenceDetails.corpRef.columnName;
        referenceDetail.columnReference = referenceDetails.corpRef.columnReference;
        referenceDetail.columnValue = referenceDetails.reqValue;
        return referenceDetail;

    });
    return corpReferenceDetails;
}
const fetchRecordsByDate = async (data) => {
    logger.loggerInstance.trace(__filename, "fetchRecordsByDate", logText.ENTRY_WITH_PARAM, data);

    let response = {};
    let statusCode = constants.STATUS_CODE.SUCCESS;
    try {

        //Validate Security Master Id
        let checkSecurityMasterId = checkValid(data.securityMasterId, 'Y', 'alphanumeric');
        if (checkSecurityMasterId != '000') {
            throw new ApiException(400, "ERR_2576", "Invalid Security Id")
        }
        //Validate Corporate Action Type Id
        let checkSecurityCorpActionType = checkValid(data.corporateActionTypeId, 'Y', 'numeric');
        if (checkSecurityCorpActionType != '000') {
            throw new ApiException(400, "ERR_2577", "Invalid Corporate Action Type Id")
        }
        //Validate Record Date
        let checkRecordDate = checkValid(data.recordDate, 'Y', 'yyyymmddformat');
        if (checkRecordDate != '000') {
            throw new ApiException(400, "ERR_2578", "Invalid Record Date")
        }

        let corporateRequestDetails = await getCorpActionFetchByDate(data);

        if (corporateRequestDetails.length == 0) {
            throw new ApiException(404, "ERR_2579", "No Record Found")
        }
        response.corporateRequestDetails = corporateRequestDetails.map(formatRecordsByDateResponse);

    } catch (e) {
        console.log(e);
        if (e instanceof ApiException) {
            response = errorConstants[e.errorCode];
            statusCode = e.statusCode;
        } else {
            response = errorConstants['ERR_2580'];
            statusCode = '500';
        }

    }

    logger.loggerInstance.trace(__filename, "fetchRecordsByDate", logText.EXIT_WITH_PARAM, response);
    return { "statusCode": statusCode, "statusMessage": response };
}

const fetchUploadedData = async (data) => {
    logger.loggerInstance.trace(__filename, "fetchUploadedData", logText.ENTRY_WITH_PARAM, data);
    data.isUpload = BOOLEAN.TRUE
    let response = await retreiveCorporateRequestDetails(data);
    if (response && response.errorCode) {
        logger.loggerInstance.trace(__filename, "fetchUploadedData", logText.EXIT);
        return { "statusCode": constants.STATUS_CODE.DB_ORM_ERROR, "statusMessage": response }
    }
    logger.loggerInstance.trace(__filename, "fetchUploadedData", logText.EXIT_WITH_PARAM, response);
    return { "statusCode": constants.STATUS_CODE.SUCCESS, "statusMessage": response };
}
const buildSecurityStatusChangeData = async (data) => {
    logger.loggerInstance.trace(__filename, "buildSecurityStatusChangeData", logText.ENTRY_WITH_PARAM, data);
    let response;
    let result = [];
    for (let caData of data) {
        response = await updateSecurityStatus(caData);
        result.push(response);
    }
    for (let idxResult of result) {
        if (idxResult.error) {
            logger.loggerInstance.error(__filename, "buildSecurityStatusChangeData", idxResult);
            logger.loggerInstance.trace(__filename, "buildSecurityStatusChangeData", logText.EXIT);
            return 0
        }
    }
    logger.loggerInstance.trace(__filename, "buildSecurityStatusChangeData", logText.EXIT);
}
const updateSecurityStatus = async (data) => {
    logger.loggerInstance.trace(__filename, "updateSecurityStatus", logText.ENTRY_WITH_PARAM, data);
    data.statusToBeChanged = constants.SECURITY_STATUS.CLOSED;
    let response = await updateSecurityMasterStatus(data);
    if (response && response.errorCode) {
        logger.loggerInstance.trace(__filename, "updateSecurityStatus", logText.EXIT_WITH_PARAM, response);
        return { "statusCode": constants.STATUS_CODE.DB_ORM_ERROR, "statusMessage": response }
    }
    let securityStatusData = {
        securityMasterId: data.securityMasterId,
        securityStatusId: data.statusToBeChanged
    }
    await securityStatusChangePublisher(securityStatusData);
    logger.loggerInstance.trace(__filename, "updateSecurityStatus", logText.EXIT_WITH_PARAM, response);
    return { "statusCode": constants.STATUS_CODE.SUCCESS, "statusMessage": response };
}
const processNextStep = async (data) => {
    logger.loggerInstance.trace(__filename, "processNextStep", logText.ENTRY_WITH_PARAM, data);
    let securityStatusChangeCaList = []; //Effective date security change list 

    if (securityStatusChangeCaList.includes(data.refCorporateActionId)) {
        await updateSecurityStatus(data);
    }
    if ((constants.PAYMENT_PROCESS_CA_LIST).includes(data.refCorporateActionId)) {
        await createPaymentGenerationData(data);
    }
    logger.loggerInstance.trace(__filename, "processNextStep", logText.EXIT);
}
const buildPaymentGenerationData = async (data) => {
    logger.loggerInstance.trace(__filename, "buildPaymentGenerationData", logText.ENTRY_WITH_PARAM, data);
    let response;
    let result = [];
    for (let caData of data) {
        response = await createPaymentGenerationData(caData);
        result.push(response);
    }
    for (let idxResult of result) {
        if (idxResult.error) {
            logger.loggerInstance.error(__filename, "buildPaymentGenerationData", idxResult);
            logger.loggerInstance.trace(__filename, "buildPaymentGenerationData", logText.EXIT);
            return 0
        }
    }
    logger.loggerInstance.trace(__filename, "buildPaymentGenerationData", logText.EXIT);
}
const createPaymentGenerationData = async (data, sequelizeTxn) => {
    logger.loggerInstance.trace(__filename, "createPaymentGenerationData", logText.ENTRY_WITH_PARAM, data);
    console.log("Process Payment");
    let caSpecificConfig = constants.CORPORATE_ACTION_DETAILS[data.refCorporateActionId];
    let result = null;
    //Check if updating securities is allowed in this corporate action
    if (caSpecificConfig.paymentDataGeneration) {
        let assetClassId;
        if (caSpecificConfig.assetClassDynamicAmount) {
            let securityInfo = await retrieveSecurityMasterDetails({ securityMasterId: data.securityMasterId });
            assetClassId = securityInfo.assetClassId
        }
        let corporateActionAllotmentRequests = await getCorporateRequestDetails(data);
        if (corporateActionAllotmentRequests == null || Object.entries(corporateActionAllotmentRequests).length == 0) {
            result = { statusCode: constants.STATUS_CODE.VALIDATION_ERROR, error: errorConstants.ERR_2522 };
        }
        else {
            //let sequelizeTxn = await dbInstance.transaction();
            try {
                for (let [corporateReqId, corporateReqData] of Object.entries(corporateActionAllotmentRequests)) {
                    let paymentSequenceList = caSpecificConfig.paymentSequenceList
                    for (let paymentSequenceIndex of paymentSequenceList) {
                        let creditBankAccountNumber, creditBankAccountType;
                        if (caSpecificConfig[paymentSequenceIndex].isSuspenseAccount && corporateReqData.bnxBankAccount) {
                            creditBankAccountNumber = corporateReqData.bnxBankAccount
                            creditBankAccountType = constants.BANK_ACC_TYPE.SAVINGS
                        } else if (caSpecificConfig[paymentSequenceIndex].isSuspenseAccount === BOOLEAN.FALSE && corporateReqData.bnxBankAccount) {
                            continue;
                        } else {
                            let bankDetailsParam = {};
                            bankDetailsParam.dpAcctId = corporateReqData.dpAcctId
                            let userBankAccountDetails = await getUserBankAccountDetails(bankDetailsParam);
                            creditBankAccountNumber = userBankAccountDetails.accountNumber
                            //Codition check need to be removed once onboarding defect is resolved
                            if (userBankAccountDetails.bankAccountType == constants.BANK_ACCT_TYPE_ID.SAVINGS) {
                                creditBankAccountType = constants.BANK_ACC_TYPE.SAVINGS
                            } else if (userBankAccountDetails.bankAccountType == constants.BANK_ACCT_TYPE_ID.CURRENT) {
                                creditBankAccountType = constants.BANK_ACC_TYPE.CURRENT
                            } else if (userBankAccountDetails.bankAccountType == constants.BANK_ACCT_TYPE_ID.OVER_DRAFT) {
                                creditBankAccountType = constants.BANK_ACC_TYPE.OVER_DRAFT
                            } else {
                                creditBankAccountType = (userBankAccountDetails.bankAccountType).toUpperCase()
                            }
                        }
                        let caPaymentRequest = {};
                        caPaymentRequest.dpAcctId = corporateReqData.dpAcctId;
                        caPaymentRequest.txnRefNo = corporateReqId;
                        caPaymentRequest.debitBankAccountNumber = corporateReqData.bnxBankAccountNo
                        caPaymentRequest.debitBankAccountType = constants.BANK_ACC_TYPE.SAVINGS
                        caPaymentRequest.creditBankAccountNumber = creditBankAccountNumber
                        caPaymentRequest.creditBankAccountType = creditBankAccountType
                        if (caSpecificConfig[paymentSequenceIndex].paymentReference)
                            caPaymentRequest.amount = corporateReqData[caSpecificConfig[paymentSequenceIndex].paymentReference]
                        else
                            caPaymentRequest.amount = corporateReqData[caSpecificConfig.paymentColumnReference]
                        if (caSpecificConfig.assetClassDynamicAmount) {
                            if (assetClassId == constants.ASSET_CLASS_TYPE_ID.FIXED_INCOME && caSpecificConfig[paymentSequenceIndex].paymentReferenceFixedIncome) {
                                caPaymentRequest.amount = corporateReqData[caSpecificConfig[paymentSequenceIndex].paymentReferenceFixedIncome]
                            } else if (assetClassId == constants.ASSET_CLASS_TYPE_ID.SUKUK && caSpecificConfig[paymentSequenceIndex].paymentReferenceSharia) {
                                caPaymentRequest.amount = corporateReqData[caSpecificConfig[paymentSequenceIndex].paymentReferenceSharia]
                            } else {
                                caPaymentRequest.amount = corporateReqData[caSpecificConfig.paymentColumnReference]
                            }
                        }
                        if (caPaymentRequest.amount > 0) {
                            let bulkPaymentResponse = await initiateBulkPaymentRequest(caPaymentRequest);
                        } else {
                            logger.loggerInstance.info(__filename, "createPaymentGenerationData - Amount is zero, caPaymentRequest", caPaymentRequest);
                        }
                    }
                }
                result = { statusCode: constants.STATUS_CODE.SUCCESS, success: true };

            } catch (error) {
                logger.loggerInstance.error(__filename, "updateSecurities", error);
                if (sequelizeTxn && !sequelizeTxn.finished)
                    sequelizeTxn.rollback();
                result = { statusCode: constants.STATUS_CODE.UNEXPECTED_ERROR, error: errorConstants.ERR_2600 }
            }
        }
    } else {
        result = { statusCode: constants.STATUS_CODE.VALIDATION_ERROR, error: errorConstants.ERR_2595 }
    }

    //TODO - build message and save into the ach record table
    logger.loggerInstance.trace(__filename, "createPaymentGenerationData", logText.EXIT_WITH_PARAM, result);
    return result;
}
module.exports = {
    listOfInvestors, saveAllotmentFile, saveCorporateActionRequest, updatecorporateActionRecordStatus,
    saveCorporateActionRecord, updateSecurities, retrieveCorporateAction, updateRecordChange, modifyCorporateActionRecord, retrieveMarketLtpData,
    //  viewApprovedInfo, updateCorporateRequest, viewCorporateRequest,// might be needed later
    retrieveCorporateDates, buildCorporateActionData, fetchRecordsByDate, updatecorporateRequestUploadStatus, fetchUploadedData,
    updateSecurityStatus, buildSecurityStatusChangeData, buildPaymentGenerationData, retrieveMarketClosePriceData
}