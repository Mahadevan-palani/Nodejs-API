const logger = require('../../common/helpers/log/logger');
const logText = require('../../common/helpers/log/constants');
const { marketCloseprice, refCorporateActionRecordStatus, corporateRequest,
    corporateRequestDetails, refAssetClass, refSecurityType, corporateRefDetails,
    corporateRef, corporateActionRecord, corporateActionListOfInvestors, securityMasterModel,
    dpAccount, dpInvestorMapping, user, refCorporateActionRequestStatus, userIndividual,
    invUserCorporate, userBankAccount } = require("../../common/helpers/db");
const { commonErrorHandler } = require('../../exceptionManager/services/commonErrorHandler');
const exceptionConstants = require('../../common/util/exceptionConstants');
const constants = require('../../common/util/constants');
const { getDpAcctDetails } = require('../../validationManager/basicValidator');
const { getConvertStartDay, getConvertEndDay, getSpecificDateWithEndTime } = require("../../common/util/dateHandler")
const moment = require("moment");
const { Op } = require("sequelize");
corporateActionListOfInvestors.belongsTo(corporateActionRecord, { as: 'caRec', foreignKey: 'corporateActionRecordId' });
// corporateActionRecord.belongsTo(refCorporateActionRequestStatus, { as: 'refCor', foreignKey: 'corporateActionRequestStatusId' });
refSecurityType.belongsTo(refAssetClass, { as: 'refAs', foreignKey: 'assetClassId' });
securityMasterModel.belongsTo(refSecurityType, { as: 'refSec', foreignKey: 'securityTypeId' });
corporateActionRecord.belongsTo(corporateRef, { as: 'caRef', foreignKey: 'refCorporateActionId' });
corporateRequestDetails.belongsTo(corporateRefDetails, { as: 'corpRef', foreignKey: 'corporateRefDetailsId' });
const { getMakerCheckerData } = require('../../common/util/commonFunctions');
const { getConvertDateOnly, getConvertDate } = require('../../common/util/dateHandler');
const { CORPORATE_REQUEST_UPLOAD_STATUS, NULL_VALUE, LIST_OF_INVESTORS_DP_ACCOUNT_MAPPING } = require('../../common/util/constants');
const { getSecurityDetailsBySecurityId } = require('../../sharedManager/controller/sharedController');
user.hasOne(userIndividual, { as: 'userInvd', foreignKey: 'userId' });
user.hasOne(invUserCorporate, { as: 'userCorp', foreignKey: 'userId' });

const saveEachCorporateReq = async (data, sequelizeTxn) => {
    logger.loggerInstance.trace(__filename, "saveEachCorporateReq", logText.ENTRY_WITH_PARAM, data);
    let txnObj = (sequelizeTxn) ? { transaction: sequelizeTxn } : {};
    let output = await corporateRequest.create(data, txnObj).then((corporateRequestData) => {
        return corporateRequestData;
    }).catch(async (error) => {
        logger.loggerInstance.error("Error occurred in saveEachCorporateReq : ", error);
        const response = await commonErrorHandler({ type: exceptionConstants.EXCEPTION_TYPE.ORM, data, error, fileName: __filename, methodName: "saveEachCorporateReq" });
        throw response;
    })
    logger.loggerInstance.trace(__filename, "saveEachCorporateReq", logText.EXIT_WITH_PARAM, output);
    return output;
}

const saveCorporateReqDetails = async (data, sequelizeTxn) => {

    logger.loggerInstance.trace(__filename, "saveCorporateReqDetails", logText.ENTRY_WITH_PARAM, data);
    let txnObj = (sequelizeTxn) ? { transaction: sequelizeTxn } : {};
    let output = await corporateRequestDetails.create(data, txnObj).then((corporateRequestData) => {
        return corporateRequestData;
    }).catch(async (error) => {
        logger.loggerInstance.error("Error occurred in saveCorporateReqDetails : ", error);
        const response = await commonErrorHandler({ type: exceptionConstants.EXCEPTION_TYPE.ORM, data, error, fileName: __filename, methodName: "saveCorporateReqDetails" });
        throw response;
    })
    logger.loggerInstance.trace(__filename, "saveCorporateReqDetails", logText.EXIT_WITH_PARAM, output);
    return output;

}

const getCorporateRefDetails = async (data) => {

    logger.loggerInstance.trace(__filename, "getCorporateRefDetails", logText.ENTRY_WITH_PARAM, data);
    corporateRefDetails.belongsTo(corporateRef, { foreignKey: 'corporateRefId' });
    return corporateRefDetails.findAll({
        where: {
            corporateRefId: data.corporateRefId
        }
    }).then(response => {
        return response;
    }).catch(async (error) => {
        logger.loggerInstance.error(__filename, "getCorporateRefDetails", error);
        const response = await commonErrorHandler({ type: exceptionConstants.EXCEPTION_TYPE.ORM, data, error, fileName: __filename, methodName: "getCorporateRefDetails" });
        throw response;
    });

}

const saveCorporateActionRequest = async (corporateRefDetails, caRecord, caData, sequelizeTxn) => {
    let corporateRequestData = {};
    if (caRecord.makerId) {
        corporateRequestData.makerId = caData.makerId
    }
    corporateRequestData.securityMasterId = caData.securityMasterId;
    corporateRequestData.investorName = caRecord.investorName;
    corporateRequestData.dpAccountId = caRecord.dpAcctId;
    corporateRequestData.dpAccountStatus = caRecord.depositoryACStatus;
    corporateRequestData.currentHolding = caRecord.currentHolding ? caRecord.currentHolding : 0;
    corporateRequestData.recordDate = caData.recordDate;
    corporateRequestData.corporateRefId = caData.corporateActionTypeId;
    corporateRequestData.recordDtClosingPrice = caRecord.recordDtClosingPrice ? caRecord.recordDtClosingPrice : 0;
    corporateRequestData.effectiveStartDate = caData.effectiveStartDate;
    corporateRequestData.corporateActionRecordId = caData.corporateActionRecordId
    if (caData.bnxBankAccount) {
        corporateRequestData.bnxBankAccountNo = caData.bnxBankAccount
    }
    // corporateRequestData.corporateActionRequestStatusId = constants.CORPORATE_REQUEST.VERIFIED

    let corporateReqSaveOutput = await saveEachCorporateReq(corporateRequestData, sequelizeTxn);
    let corporateReqDetailsSaveOutput = null;
    for (let idx in corporateRefDetails) {
        let corporateReqDetailsData = {};
        corporateReqDetailsData.corporateReqId = corporateReqSaveOutput.corporateReqId;
        corporateReqDetailsData.corporateRefDetailsId = corporateRefDetails[idx].corporateRefDetailsId;
        corporateReqDetailsData.reqValue = caRecord[corporateRefDetails[idx].columnReference];

        corporateReqDetailsSaveOutput = await saveCorporateReqDetails(corporateReqDetailsData, sequelizeTxn);
    }

    return { corporateReqSaveOutput: corporateReqSaveOutput, corporateReqDetailsSaveOutput: corporateReqDetailsSaveOutput };

}

const corporateActionDao = async (caData, sequelizeTxn) => {
    logger.loggerInstance.trace(__filename, "corporateActionDao", logText.ENTRY_WITH_PARAM, caData);
    let makerCheckerData = await getMakerCheckerData(caData)
    caData = { ...caData, makerCheckerData }
    let corporateRefParams = {};
    corporateRefParams.corporateRefId = caData.corporateActionTypeId;
    let corporateRefDetails = await getCorporateRefDetails(corporateRefParams);
    try {
        for (let idx in caData.allotmentList) {

            let data = caData.allotmentList[idx];

            //Fetch Depository acount details for fetching dpAcctId
            if (data.depositoryAccountNo) {
                let dpAccParams = {};
                dpAccParams.depositoryAccountNumber = data.depositoryAccountNo;
                let dpAccountDetails = await getDpAcctDetails(dpAccParams);
                data.dpAcctId = dpAccountDetails.dpAcctId;
            }
            logger.loggerInstance.trace(__filename, "corporateActionDao", "row number: " + idx, data);
            await saveCorporateActionRequest(corporateRefDetails, data, caData, sequelizeTxn);
        }
    } catch (error) {
        logger.loggerInstance.error(__filename, "corporateActionDao", error);
        if (error && error.errorCode) {
            if (sequelizeTxn && !sequelizeTxn.finished)
                sequelizeTxn.rollback();
        }
        throw error;
    }
    logger.loggerInstance.trace(__filename, "corporateActionDao", logText.EXIT_WITH_PARAM, { success: true });
    return { success: true };
}

const createCorporateActionRecord = async (data, sequelizeTxn) => {
    logger.loggerInstance.trace(__filename, "createCorporateActionRecord", logText.ENTRY_WITH_PARAM, data);
    let txnObj = (sequelizeTxn) ? { transaction: sequelizeTxn } : {};
    let output = await corporateActionRecord.create(data, txnObj).then((corporateActionData) => {
        return corporateActionData;
    }).catch(async (error) => {
        const response = await commonErrorHandler({ type: exceptionConstants.EXCEPTION_TYPE.ORM, data, error, fileName: __filename, methodName: "createCorporateActionRecord" });
        return { error: response };
    })
    logger.loggerInstance.trace(__filename, "createCorporateActionRecord", logText.EXIT_WITH_PARAM, output);
    return output;
}

const retrieveCaRecordDetails = async (data) => {
    logger.loggerInstance.trace(__filename, "retriveCaRecordDetails", logText.ENTRY_WITH_PARAM, data);
    corporateActionRecord.belongsTo(securityMasterModel, { foreignKey: 'securityMasterId' });
    securityMasterModel.belongsTo(refSecurityType, { foreignKey: 'securityTypeId' });
    refSecurityType.belongsTo(refAssetClass, { foreignKey: 'assetClassId' });
    let output = await corporateActionRecord.findOne({
        include: [{
            model: securityMasterModel,
            attributes: ['securitySymbol', 'securityTypeId'],
            include: [{
                model: refSecurityType, as: 'refSec',
                attributes: ['securityTypeId', 'description'],
                include: [{
                    model: refAssetClass, as: 'refAs',
                    attributes: ['assetClassId', 'description'],
                }]
            }]
        }],
        where: {
            corporateActionId: data.corporateActionRecordId
        },
        raw: true
    }).then((recordDetails) => {
        let response = {}
        response.securityMasterId = recordDetails.securityMasterId
        response.securityName = recordDetails['security_master.securitySymbol']
        response.secTypeDescription = recordDetails['security_master.refSec.description']
        response.assetDescription = recordDetails['security_master.refSec.refAs.description']
        logger.loggerInstance.trace(__filename, "retriveCaRecordDetails", logText.EXIT_WITH_PARAM, response);
        return response;
    }).catch(async (error) => {
        const response = await commonErrorHandler({ type: exceptionConstants.EXCEPTION_TYPE.ORM, data, error, fileName: __filename, methodName: "retriveCaRecordDetails" });
        return response;
    });
    logger.loggerInstance.trace(__filename, "retriveCaRecordDetails", logText.EXIT_WITH_PARAM, output);
    return output;
}

const listOfInvestorsDao = async (data) => {
    logger.loggerInstance.trace(__filename, "listOfInvestorsDao", logText.ENTRY_WITH_PARAM, data);
    corporateActionListOfInvestors.belongsTo(corporateActionRecord, { foreignKey: 'corporateActionRecordId' });
    corporateActionListOfInvestors.belongsTo(dpAccount, { foreignKey: 'dpAcctId' });
    corporateActionRecord.belongsTo(securityMasterModel, { foreignKey: 'securityMasterId' });
    securityMasterModel.belongsTo(refSecurityType, { foreignKey: 'securityTypeId' });
    refSecurityType.belongsTo(refAssetClass, { foreignKey: 'assetClassId' });
    dpInvestorMapping.belongsTo(user, { foreignKey: 'userId' });
    user.hasOne(userIndividual, { foreignKey: 'userId' });
    user.hasOne(invUserCorporate, { foreignKey: 'userId' });
    let bodRecordDate = getConvertDateOnly(data.recordDate);
    // let eodRecordDate = getConvertEndDay(data.recordDate);
    let caListOfInvestorParam = {
        currentQty: { [Op.gt]: constants.NULL_VALUE.ZERO },
    }
    if (data.corporateActionRecordId) {
        caListOfInvestorParam.corporateActionRecordId = data.corporateActionRecordId
    }
    let output = await corporateActionListOfInvestors.findAll({
        attributes: ['currentQty'],
        where: caListOfInvestorParam,
        include: [{
            model: corporateActionRecord, as: 'caRec',
            attributes: ['securityMasterId', 'recordDate', 'effectiveStartDate', 'corporateActionId'],
            include: [{
                model: securityMasterModel,
                attributes: ['securitySymbol', 'securityTypeId'],
                include: [{
                    model: refSecurityType, as: 'refSec',
                    attributes: ['securityTypeId', 'description'],
                    include: [{
                        model: refAssetClass, as: 'refAs',
                        attributes: ['assetClassId', 'description'],
                    }]
                }]
            }
            ],
            where: {
                securityMasterId: data.securityMasterId,
                refCorporateActionId: data.corporateActionTypeId,
                recordDate: bodRecordDate
            }
        }, {
            model: dpAccount,
            attributes: ['dpAccountNo', 'status', 'dpAcctStatusId'],
            include: [{
                model: dpInvestorMapping, as: 'dpInvMap',
                attributes: ['userId'],
                include: [{
                    model: user,
                    attributes: ['displayName', 'email'],
                    include: [{
                        model: userIndividual,
                        attributes: ['firstName']
                    },
                    {
                        model: invUserCorporate,
                        attributes: ['companyName']
                    }]
                }]
            }]
        }],
        raw: true
    }).then((listOfInvestorData) => {
        const investorList = [];
        for (let index in listOfInvestorData) {
            investorList[index] = {};
            investorList[index].securityMasterId = parseInt(listOfInvestorData[index]['caRec.securityMasterId']);
            investorList[index].securityName = listOfInvestorData[index]['caRec.security_master.securitySymbol'];
            investorList[index].depositoryACNo = listOfInvestorData[index]['dp_account.dpAccountNo'];
            investorList[index].depositoryACStatus = LIST_OF_INVESTORS_DP_ACCOUNT_MAPPING[parseInt(listOfInvestorData[index]['dp_account.dpAcctStatusId'])]
            if (!investorList[index].depositoryACStatus) {
                investorList[index].depositoryACStatus = "Active"
                logger.loggerInstance.info(__filename, "listOfInvestorsDao", "DP Account status: ", listOfInvestorData[index]['dp_account.dpAcctStatusId']);
            }
            investorList[index].investorName = listOfInvestorData[index]['dp_account.dpInvMap.user.user_individual.firstName'] ? listOfInvestorData[index]['dp_account.dpInvMap.user.user_individual.firstName'] : listOfInvestorData[index]['dp_account.dpInvMap.user.user_corporate.companyName']
            investorList[index].investorEmail = listOfInvestorData[index]['dp_account.dpInvMap.user.email'];
            investorList[index].currentHolding = listOfInvestorData[index]['currentQty'];
            investorList[index].secTypeDescription = listOfInvestorData[index]['caRec.security_master.refSec.description'];
            investorList[index].assetDescription = listOfInvestorData[index]['caRec.security_master.refSec.refAs.description'];
            investorList[index].recordDate = moment(new Date(listOfInvestorData[index]['caRec.recordDate'])).format(constants.DATE_HANDLER.DATE_FORMAT);
            investorList[index].serialNumber = parseInt(index) + 1;
        }
        logger.loggerInstance.trace(__filename, "listOfInvestorsDao", logText.EXIT_WITH_PARAM, investorList);
        return investorList;
    }).catch(async (error) => {
        const response = await commonErrorHandler({ type: exceptionConstants.EXCEPTION_TYPE.ORM, data, error, fileName: __filename, methodName: "listOfInvestorsDao" });
        return response;
    });
    logger.loggerInstance.trace(__filename, "listOfInvestorsDao", logText.EXIT_WITH_PARAM, output);
    return output;

}

const getCorporateActionRecord = async (data) => {
    logger.loggerInstance.trace(__filename, "getCorporateActionRecord", logText.ENTRY_WITH_PARAM, data);
    let queryParams = {};
    if (data) {
        if (data.corporateActionTypeId) {
            queryParams.refCorporateActionId = data.corporateActionTypeId;
        }
        if (data.recordDate) {
            queryParams.recordDate = new Date(data.recordDate);
        }
        if (data.securityMasterId) {
            queryParams.securityMasterId = data.securityMasterId;
        }
        if (data.processName && data.corporateActionRecordId) {
            queryParams.corporateActionId = data.corporateActionRecordId
        }
        if (data.processName && data.corporateActionStatusId) {
            queryParams.corporateActionStatusId = data.corporateActionStatusId
        }
        if (data.reworkProcess && data.corporateActionId) {
            queryParams.corporateActionId = {
                [Op.ne]: data.corporateActionId
            }
        }
        queryParams.corporateActionRecordStatusId = {
            [Op.notIn]: [constants.CORPORATE_ACTION_RECORD.REJECTED, constants.CORPORATE_ACTION_RECORD.DELETED]
        }
    }
    let output = corporateActionRecord.findAll({
        where: queryParams,
        raw: true
    }).then((result) => {
        return result;
    }).catch((error) => {
        logger.loggerInstance.error(__filename, "getCorporateActionRecord", error);
        return [];
    })
    logger.loggerInstance.trace(__filename, "getCorporateActionRecord", logText.EXIT_WITH_PARAM, output);
    return output;

}

const getCorporateRequestDetails = async (data) => {
    let recordDate = getConvertDate(data.recordDate);
    logger.loggerInstance.trace(__filename, "getCorporateRequestDetails", logText.ENTRY_WITH_PARAM, data);
    corporateRequestDetails.belongsTo(corporateRequest, { foreignKey: 'corporateReqId' });
    corporateRequestDetails.belongsTo(corporateRefDetails, { foreignKey: 'corporateRefDetailsId' });
    // corporateRequest.hasMany(corporateRequestDetails);

    let securityMasterId = data.securityMasterId;
    let refCorporateActionId = data.refCorporateActionId;
    let whereParam = {}
    whereParam = {
        securityMasterId: securityMasterId,
        corporateRefId: refCorporateActionId,
        recordDate: recordDate
    }
    let uploadStatusId
    if (data.isUpload) {
        uploadStatusId = {
            [Op.or]: {
                [Op.eq]: CORPORATE_REQUEST_UPLOAD_STATUS.ACTIVE,
                [Op.is]: NULL_VALUE.NULL
            }
        }
        if (data.corporateActionRecordId) {
            whereParam.corporateActionRecordId = data.corporateActionRecordId
        }
    } else {
        uploadStatusId = CORPORATE_REQUEST_UPLOAD_STATUS.ACTIVE
    }
    whereParam.refCorporateRequestUploadStatusId = uploadStatusId
    return corporateRequestDetails.findAll({
        include: [{
            model: corporateRequest,
            attributes: ['dpAccountId', 'recordDate', 'currentHolding', 'bnxBankAccountNo'],
            where: whereParam
        }, {
            model: corporateRefDetails,
            attributes: ['columnReference']
        }
        ],
        raw: true,
        group: ['corporate_request.corporate_request_id', 'corporate_request_details.corporate_request_details_id',
            'ref_corporate_action_detail.column_reference']
    }).then(responseList => {
        let allotmentMap = {};
        for (let idx in responseList) {

            let allotment = responseList[idx];
            let currentAllotment = {};
            if (allotmentMap[allotment.corporateReqId]) {
                currentAllotment = allotmentMap[allotment.corporateReqId];
            } else {
                currentAllotment.corporateReqId = allotment.corporateReqId;
                //currentAllotment.recordDate = allotment['corporate_request.recordDate'];
                currentAllotment.dpAcctId = allotment['corporate_request.dpAccountId'];
                currentAllotment.currentHolding = allotment['corporate_request.currentHolding'];
                currentAllotment.bnxBankAccountNo = allotment['corporate_request.bnxBankAccountNo'];
            }
            currentAllotment[allotment['ref_corporate_action_detail.columnReference']] = allotment['reqValue'];
            allotmentMap[allotment.corporateReqId] = currentAllotment;

        }

        logger.loggerInstance.trace(__filename, "getCorporateRequestDetails", logText.EXIT_WITH_PARAM, allotmentMap);
        return allotmentMap;
    }).catch(async (error) => {
        logger.loggerInstance.error(__filename, "getCorporateRequestDetails", error);
        const response = await commonErrorHandler({ type: exceptionConstants.EXCEPTION_TYPE.ORM, data, error, fileName: __filename, methodName: "getCorporateRequestDetails" });
        return response;
    });

}

const retreiveCorporateRequestDetails = async (data) => {
    let recordDate = getConvertDate(data.recordDate);
    logger.loggerInstance.trace(__filename, "retreiveCorporateRequestDetails", logText.ENTRY_WITH_PARAM, data);
    corporateRequestDetails.belongsTo(corporateRequest, { foreignKey: 'corporateReqId' });
    corporateRequestDetails.belongsTo(corporateRefDetails, { foreignKey: 'corporateRefDetailsId' });
    corporateRequest.belongsTo(dpAccount, { foreignKey: 'dpAccountId' });
    dpInvestorMapping.belongsTo(user, { foreignKey: 'userId' });

    let securityMasterId = data.securityMasterId;
    let refCorporateActionId = data.refCorporateActionId;
    let whereParam = {}
    whereParam = {
        securityMasterId: securityMasterId,
        corporateRefId: refCorporateActionId,
        recordDate: recordDate
    }
    let uploadStatusId
    if (data.isUpload) {
        uploadStatusId = {
            [Op.or]: {
                [Op.eq]: CORPORATE_REQUEST_UPLOAD_STATUS.ACTIVE,
                [Op.is]: NULL_VALUE.NULL
            }
        }
        if (data.corporateActionRecordId) {
            whereParam.corporateActionRecordId = data.corporateActionRecordId
        }
    } else {
        uploadStatusId = CORPORATE_REQUEST_UPLOAD_STATUS.ACTIVE
    }
    whereParam.refCorporateRequestUploadStatusId = uploadStatusId
    return corporateRequestDetails.findAll({
        include: [{
            model: corporateRequest,
            attributes: ['dpAccountId', 'recordDate', 'currentHolding', 'dpAccountStatus'],
            where: whereParam,
            include: [{
                model: dpAccount,
                attributes: ['dpAcctId', 'dpAccountNo', 'status'],
                include: [{
                    model: dpInvestorMapping, as: 'dpInvMap',
                    attributes: ['userId'],
                    include: [{
                        model: user,
                        attributes: ['displayName', 'email'],
                        include: [{
                            model: userIndividual, as: 'userInvd',
                            attributes: ['firstName']
                        },
                        {
                            model: invUserCorporate, as: 'userCorp',
                            attributes: ['companyName']
                        }]
                    }]
                }]
            }]
        }, {
            model: corporateRefDetails,
            attributes: ['columnReference']
        }],
        raw: true,
        group: ['corporate_request.corporate_request_id', 'corporate_request_details.corporate_request_details_id',
            'ref_corporate_action_detail.column_reference', 'corporate_request->dp_account.dp_acct_id',
            'corporate_request->dp_account->dpInvMap.dp_investor_mapping', 'corporate_request->dp_account->dpInvMap->user.user_id',
            'corporate_request->dp_account->dpInvMap->user->userInvd.user_individual_id', 'corporate_request->dp_account->dpInvMap->user->userCorp.corporate_master_id']
    }).then(responseList => {
        let allotmentMap = {};
        for (let idx in responseList) {

            let allotment = responseList[idx];
            let currentAllotment = {};
            if (allotmentMap[allotment.corporateReqId]) {
                currentAllotment = allotmentMap[allotment.corporateReqId];
            } else {
                currentAllotment.corporateReqId = allotment.corporateReqId;
                currentAllotment.recordDate = allotment['corporate_request.recordDate'];
                currentAllotment.dpAcctId = allotment['corporate_request.dpAccountId'];
                currentAllotment.investorName = allotment['corporate_request.dp_account.dpInvMap.user.userInvd.firstName'] ? allotment['corporate_request.dp_account.dpInvMap.user.userInvd.firstName'] : allotment['corporate_request.dp_account.dpInvMap.user.userCorp.companyName'];
                currentAllotment.investorEmail = allotment['corporate_request.dp_account.dpInvMap.user.email'];
                currentAllotment.currentHolding = allotment['corporate_request.currentHolding'];
                currentAllotment.depositoryACNo = allotment['corporate_request.dp_account.dpAccountNo'];
                currentAllotment.depositoryACStatus = allotment['corporate_request.dpAccountStatus']
            }
            currentAllotment[allotment['ref_corporate_action_detail.columnReference']] = allotment['reqValue'];
            allotmentMap[allotment.corporateReqId] = currentAllotment;

        }
        logger.loggerInstance.trace(__filename, "retreiveCorporateRequestDetails", logText.EXIT_WITH_PARAM, allotmentMap);
        return allotmentMap;
    }).catch(async (error) => {
        logger.loggerInstance.error(__filename, "retreiveCorporateRequestDetails", error);
        const response = await commonErrorHandler({ type: exceptionConstants.EXCEPTION_TYPE.ORM, data, error, fileName: __filename, methodName: "retreiveCorporateRequestDetails" });
        return response;
    });

}

const updateCorporateActionRecord = async (data) => {
    logger.loggerInstance.trace(__filename, "updateCorporateActionRecord", logText.ENTRY_WITH_PARAM, data);

    //Eg:corporateActionStatusId  = 3 (created)
    let paramsToUpdate = data.paramsToUpdate;

    //Eg: where recordDate = 2021-06-03
    let filterParams = data.filterParams;
    let output = await corporateActionRecord.update(paramsToUpdate, { where: filterParams });

    logger.loggerInstance.trace(__filename, "updateCorporateActionRecord", logText.EXIT_WITH_PARAM, output);
    return output;
}

const retrieveMarketLtpDataDao = async (data) => {
    logger.loggerInstance.trace(__filename, "retrieveMarketLtpDataDao", logText.ENTRY_WITH_PARAM, data);
    return marketCloseprice.findAll(
        {
            where: {
                securityMasterId: data.securityMasterId
            }
        }
    ).then(response => {
        logger.loggerInstance.trace(__filename, "retrieveMarketLtpDataDao", logText.EXIT);
        return response[0];
    }).catch(err => {
        logger.loggerInstance.error(__filename, "retrieveMarketLtpDataDao", err);
    })
}

const retrieveMarketClosePrice = async (data) => {
    logger.loggerInstance.trace(__filename, "retrieveMarketClosePrice", logText.ENTRY_WITH_PARAM, data);
    let param = {}
    param.securityMasterId = data.securityMasterId
    let dateValue = getSpecificDateWithEndTime(data.recordDate)
    param.tradeDateTime = { [Op.lte]: dateValue }
    return marketCloseprice.findOne({
        order: [['tradeDateTime', 'DESC']],
        where: param,
        attributes: ['closePrice'],
        raw: true
    }).then(async (response) => {
        logger.loggerInstance.trace(__filename, "retrieveMarketClosePrice", logText.EXIT_WITH_PARAM, response);
        return response;
    }).catch(async (error) => {
        logger.loggerInstance.error(__filename, "retrieveMarketLtpDataDao", error);
        const response = await commonErrorHandler({ type: exceptionConstants.EXCEPTION_TYPE.ORM, data, error, fileName: __filename, methodName: "retrieveMarketClosePrice" });
        return response;
    })
}

const corporateActionDetail = async (data) => {
    logger.loggerInstance.trace(__filename, "corporateActionDetail", logText.ENTRY_WITH_PARAM, data);
    let securityTypeParam = {}
    let securityMasterParam = {}
    let param = {};
    if (data.corporateActionId) {
        param.corporateActionId = data.corporateActionId
    }
    if (data.corporateActionTypeId) {
        param.refCorporateActionId = data.corporateActionTypeId
    }
    if (data.securityMasterId) {
        param.securityMasterId = data.securityMasterId
    }
    if (data.status) {
        param.corporateActionRecordStatusId = data.status
    }
    if (data.assetClass) {
        securityTypeParam.assetClassId = data.assetClass
    }
    if (data.securitySymbol) {
        securityMasterParam.securitySymbol = data.securitySymbol
    }
    if (data.securityTypeId) {
        securityMasterParam.securityTypeId = data.securityTypeId
    }
    corporateActionRecord.belongsTo(securityMasterModel, { foreignKey: 'securityMasterId' });
    corporateActionRecord.belongsTo(corporateRef, { foreignKey: 'refCorporateActionId' });
    corporateActionRecord.belongsTo(refCorporateActionRecordStatus, { foreignKey: 'corporateActionRecordStatusId' });
    securityMasterModel.belongsTo(refSecurityType, { foreignKey: 'securityTypeId' });
    refSecurityType.belongsTo(refAssetClass, { foreignKey: 'assetClassId' });
    return await corporateActionRecord.findAll({
        where: param,
        order: [['corporateActionId', 'DESC']],
        attributes: ['corporateActionId', 'securityMasterId', 'recordDate', 'effectiveStartDate', 'announcementDate', 'comments', 'corporateActionRecordStatusId', 'refCorporateActionId', 'checkerComment'],
        include: [
            {
                model: corporateRef, as: 'caRef',
                attributes: ['corporateAction'],
            },
            {
                model: refCorporateActionRecordStatus,
                attributes: ['description'],
            },
            {
                model: securityMasterModel,
                attributes: ['securitySymbol', 'securityTypeId'],
                where: securityMasterParam,
                include: [{
                    model: refSecurityType, as: 'refSec',
                    attributes: ['securityTypeId', 'description'],
                    where: securityTypeParam,
                    include: [{
                        model: refAssetClass, as: 'refAs',
                        attributes: ['assetClassId', 'description']
                    }]
                }]
            }],
        raw: true
    }).then(corporateAction => {
        const resultArray = [];
        let serialNumber = 0
        for (let index in corporateAction) {
            if (corporateAction[index]['security_master.refSec.securityTypeId']) {
                let filteredObject = {}
                filteredObject.corporateActionPk = corporateAction[index]['corporateActionId'];
                filteredObject.corporateActionTypeId = corporateAction[index]['refCorporateActionId'];
                filteredObject.corporateActionType = corporateAction[index]['caRef.corporateAction'];
                filteredObject.comments = corporateAction[index]['comments'];
                filteredObject.securityMasterId = parseInt(corporateAction[index]['securityMasterId']);
                filteredObject.securitySymbol = corporateAction[index]['security_master.securitySymbol'];
                filteredObject.secTypeDescription = corporateAction[index]['security_master.refSec.description'];
                filteredObject.assetDescription = corporateAction[index]['security_master.refSec.refAs.description'];
                filteredObject.recordDate = corporateAction[index]['recordDate'];
                filteredObject.announcementDate = corporateAction[index]['announcementDate'];
                filteredObject.effectiveStrtDate = corporateAction[index]['effectiveStartDate'];
                filteredObject.corporateActionStatusId = corporateAction[index]['corporateActionRecordStatusId'];
                filteredObject.corporateActionStatusDes = corporateAction[index]['ref_corporate_action_record_status.description'];
                filteredObject.checkerComment = corporateAction[index]['checkerComment'];
                filteredObject.serialNumber = serialNumber + 1;
                serialNumber += 1;
                resultArray.push(filteredObject);
            }
        }
        logger.loggerInstance.trace(__filename, "corporateActionDetail", logText.EXIT_WITH_PARAM, corporateAction);
        return resultArray;
    }).catch(async (error) => {
        const response = await commonErrorHandler({ type: exceptionConstants.EXCEPTION_TYPE.ORM, data, error, fileName: __filename, methodName: "corporateActionDetail" });
        return response;
    });
}
const corporateActionDates = async (data) => {
    logger.loggerInstance.trace(__filename, "corporateActionDates", logText.ENTRY_WITH_PARAM, data);
    let param = {};
    if (data.securityMasterId) {
        param.securityMasterId = data.securityMasterId;
    }
    if (data.corporateActionTypeId) {
        param.refCorporateActionId = data.corporateActionTypeId;
    }
    //param.corporateActionStatusId=constants.CORPORATE_ACTION_DETAILS.STATUS_ID.CREATED;
    param.corporateActionRecordStatusId = [constants.CORPORATE_ACTION_RECORD.APPROVED, constants.CORPORATE_ACTION_RECORD.UPLOAD_REJECTED, constants.CORPORATE_ACTION_RECORD.UPLOAD_DELETION_APPROVED]
    return await corporateActionRecord.findAll({
        where: param,
        attributes: ['recordDate', 'effectiveStartDate', 'corporateActionId'],
        raw: true
    }).then(retrieveDate => {

        let resultArray = [];
        for (let index in retrieveDate) {
            resultArray[index] = {};
            resultArray[index].corporateActionRecordId = retrieveDate[index]['corporateActionId'];
            resultArray[index].recordDate = retrieveDate[index]['recordDate'];
            resultArray[index].effectiveStartDate = retrieveDate[index]['effectiveStartDate'];


        }
        logger.loggerInstance.trace(__filename, "corporateActionDates", logText.EXIT_WITH_PARAM, resultArray);
        return resultArray;
    }).catch(async (error) => {

        const response = await commonErrorHandler({ type: exceptionConstants.EXCEPTION_TYPE.ORM, data, error, fileName: __filename, methodName: "corporateActionDates" });
        return response;
    });

}
// const approvedDetailDAO = async (data) => {
//     logger.loggerInstance.trace(__filename, "approvedDetailDAO", logText.ENTRY_WITH_PARAM, data);
//     let param = {};
//     let param1 = {};
//     let param2 = {};
//     if (data.corporateActionTypeId) {
//         param.corporateRefId = data.corporateActionTypeId
//     }
//     if (data.securityMasterId) {
//         param1.securityMasterId = data.securityMasterId;
//     }
//     if (data.status) {
//         param2.corporateActionRequestStatusId = data.status;
//     }
//     if (data.corporateActionRecordId) {
//         param.corporateReqId = data.corporateActionRecordId;
//     }
//     corporateRequest.belongsTo(corporateRef, { foreignKey: 'corporateRefId' });
//     corporateRequest.belongsTo(securityMasterModel, { foreignKey: 'securityMasterId' });
//     corporateRequest.belongsTo(refCorporateActionRequestStatus, { foreignKey: 'corporateActionRequestStatusId' });
//     securityMasterModel.belongsTo(refSecurityType, { foreignKey: 'securityTypeId' });
//     refSecurityType.belongsTo(refAssetClass, { foreignKey: 'assetClassId' });
//     return await corporateRequest.findAll({
//         where: param,
//         attributes: ['recordDate', 'corporateActionRequestStatusId', 'corporateReqId', 'effectiveStartDate', 'createdAt'],
//         order: [
//             ['createdAt', 'DESC']
//         ],

//         include: [

//             {
//                 model: refCorporateActionRequestStatus,
//                 where: param2,
//                 attributes: ['corporateActionRequestStatusId', 'description'],

//             },
//             {
//                 model: corporateRef,
//                 attributes: ['corporateAction'],
//             },
//             {
//                 model: securityMasterModel,
//                 where: param1,
//                 attributes: ['securitySymbol'],
//                 include: [{
//                     model: refSecurityType,
//                     attributes: ['securityTypeId', 'description'],
//                     include: [{
//                         model: refAssetClass,
//                         attributes: ['assetClassId', 'description'],
//                     }]

//                 }]
//             }
//         ],

//         raw: true

//     }).then(uploadAction => {

//         const resultArray = [];
//         for (let index in uploadAction) {
//             resultArray[index] = {};
//             resultArray[index].corporateRequestIdPk = uploadAction[index]['corporateReqId'];
//             resultArray[index].recordDate = uploadAction[index]['recordDate'];
//             resultArray[index].effectiveStrtDate = uploadAction[index]['effectiveStartDate'];
//             resultArray[index].corporateActionRequestStatusId = uploadAction[index]['corporateActionRequestStatusId'];
//             resultArray[index].corporateActionStatus = uploadAction[index]['ref_corporate_action_request_status.description'];
//             resultArray[index].securitySymbol = uploadAction[index]['security_master.securitySymbol'];
//             resultArray[index].description = uploadAction[index]['security_master.ref_security_type.description'];
//             resultArray[index].corporateActionType = uploadAction[index]['ref_corporate_action.corporateAction'];
//             resultArray[index].assetDescription = uploadAction[index]['security_master.ref_security_type.ref_asset_class.description'];

//             resultArray[index].serialNumber = parseInt(index) + 1;//to do verify  


//         }
//         logger.loggerInstance.trace(__filename, "approvedDetailDAO", logText.EXIT_WITH_PARAM, resultArray);
//         return resultArray;
//     }).catch(async (error) => {

//         const response = await commonErrorHandler({ type: exceptionConstants.EXCEPTION_TYPE.ORM, data, error, fileName: __filename, methodName: "approvedDetailDAO" });
//         return response;
//     });

// }

const updateRecordChangeRequest = async (data) => {
    logger.loggerInstance.trace(__filename, "updateRecordChangeRequest", logText.ENTRY_WITH_PARAM, data);
    let param = {};
    param.corporateActionRecordStatusId = data.corporateActionRecordStatusId
    let makerCheckerData = await getMakerCheckerData(data);
    param = { ...param, ...makerCheckerData }
    const [updateStatus, updateRequestData] = await corporateActionRecord.update(param,
        {
            where: {
                corporateActionId: data.corporateActionId
            },
            raw: true,
            returning: true
        }).catch(async (error) => {
            const response = await commonErrorHandler({ type: exceptionConstants.EXCEPTION_TYPE.ORM, data, error, fileName: __filename, methodName: "updateRecordChangeRequest" });
            return ['', response];
        });
    logger.loggerInstance.trace(__filename, "updateRecordChangeRequest", logText.EXIT_WITH_PARAM, updateRequestData);
    return updateRequestData

}

const reformCorporateActionRecord = async (data) => {
    logger.loggerInstance.trace(__filename, "reformCorporateActionRecord", logText.ENTRY_WITH_PARAM, data);
    let param = data
    param.refCorporateActionId = data.corporateActionTypeId
    param.corporateActionRecordStatusId = constants.CORPORATE_ACTION_RECORD.VERIFIED
    const [updateStatus, updateRecords] = await corporateActionRecord.update(param,
        {
            where: {
                corporateActionId: data.corporateActionId
            },
            raw: true,
            returning: true
        }).catch(async (error) => {
            const response = await commonErrorHandler({ type: exceptionConstants.EXCEPTION_TYPE.ORM, data, error, fileName: __filename, methodName: "reformCorporateActionRecord" });
            return ["", response];
        });
    return updateRecords;
}

// const updateCorporateRequestDao = async (data) => {
//     logger.loggerInstance.trace(__filename, "updateCorporateRequestDao", logText.ENTRY_WITH_PARAM, data);
//     let param = {};
//     param.corporateActionRequestStatusId = data.corporateActionRequestStatusId
//     let makerCheckerData = await getMakerCheckerData(data);
//     param = { ...param, ...makerCheckerData }
//     const [updateRequestData] = await corporateRequest.update(param,
//         {
//             where: {
//                 corporateReqId: data.corporateReqId
//             },
//             raw: true,
//             returning: true
//         }).catch(async (error) => {
//             const response = await commonErrorHandler({ type: exceptionConstants.EXCEPTION_TYPE.ORM, data, error, fileName: __filename, methodName: "updateCorporateRequestDao" });
//             return ['', response];
//         });
//     logger.loggerInstance.trace(__filename, "updateCorporateRequestDao", logText.EXIT_WITH_PARAM, updateRequestData);
//     return updateRequestData

// }

// const viewCorporateRequestDetails = async (data) => {
//     logger.loggerInstance.trace(__filename, "viewCorporateRequestDetails", logText.ENTRY_WITH_PARAM, data);
//     let param = {}
//     if (data.corporateReqId) {
//         param.corporateReqId = data.corporateReqId
//     }
//     corporateRequestDetails.belongsTo(corporateRequest, { foreignKey: 'corporateReqId' })
//     let viewCorporateRequestInfo = await corporateRequestDetails.findAll(
//         {

//             include: [{
//                 where: param,
//                 model: corporateRequest
//             }]
//         }
//     ).then((res) => {
//         return res
//     }).catch(async (error) => {
//         const response = await commonErrorHandler({ type: exceptionConstants.EXCEPTION_TYPE.ORM, data, error, fileName: __filename, methodName: "viewCorporateRequestDetails" });
//         return response;
//     });
//     logger.loggerInstance.trace(__filename, "viewCorporateRequestDetails", logText.EXIT_WITH_PARAM, viewCorporateRequestInfo);
//     return viewCorporateRequestInfo;
// }

const updatecorporateActionRecordStatusData = async (data) => {
    logger.loggerInstance.trace(__filename, "updatecorporateActionRecordStatusData", logText.ENTRY_WITH_PARAM, data);
    const requestData = {
        corporateActionRecordStatusId: data.corporateActionRecordStatusId,
        checkerComment: data.checkerComment
    }
    const [updateRequestData] = await corporateActionRecord.update(requestData,
        {
            where: {
                corporateActionId: data.corporateActionRecordId
            },
            raw: true,
            returning: true
        }).catch(async (error) => {
            const response = await commonErrorHandler({ type: exceptionConstants.EXCEPTION_TYPE.ORM, data, error, fileName: __filename, methodName: "updatecorporateActionRecordStatusData" });
            return ['', response];
        });
    logger.loggerInstance.trace(__filename, "updatecorporateActionRecordStatusData", logText.EXIT_WITH_PARAM, updateRequestData);
    return updateRequestData

}

const updateCorporateRequestUploadStatusData = async (data) => {
    logger.loggerInstance.trace(__filename, "updateCorporateRequestUploadStatusData", logText.ENTRY_WITH_PARAM, data);
    let requestData = {
        refCorporateRequestUploadStatusId: data.refCorporateRequestUploadStatusId
    }
    let whereParam = {
        corporateActionRecordId: data.corporateActionRecordId,
        refCorporateRequestUploadStatusId: {
            [Op.or]: {
                [Op.eq]: CORPORATE_REQUEST_UPLOAD_STATUS.ACTIVE,
                [Op.is]: NULL_VALUE.NULL
            }
        }
    }
    const [updateCol, updateRequestData] = await corporateRequest.update(requestData,
        {
            where: whereParam,
            raw: true,
            returning: true,
        }).catch(async (error) => {
            const response = await commonErrorHandler({ type: exceptionConstants.EXCEPTION_TYPE.ORM, data, error, fileName: __filename, methodName: "updateCorporateRequestUploadStatusData" });
            return ['', response];
        });
    logger.loggerInstance.trace(__filename, "updateCorporateRequestUploadStatusData", logText.EXIT_WITH_PARAM, updateRequestData);
    return updateRequestData

}

const getCorpActionFetchByDate = async (data) => {

    logger.loggerInstance.trace(__filename, "getCorpActionFetchByDate", logText.ENTRY_WITH_PARAM, data);
    corporateRequest.belongsTo(securityMasterModel, { foreignKey: 'securityMasterId' })
    securityMasterModel.belongsTo(refSecurityType, { foreignKey: 'securityTypeId' });
    refSecurityType.belongsTo(refAssetClass, { foreignKey: 'assetClassId' });
    corporateRequest.hasMany(corporateRequestDetails, { foreignKey: 'corporateReqId' });

    return corporateRequest.findAll({
        attributes: ['corporateReqId', 'investorName', 'dpAccountId', 'dpAccountStatus', 'currentHolding', 'recordDate', 'recordDtClosingPrice'],
        include: [{
            model: securityMasterModel,
            attributes: ['securitySymbol'],
            include: [{
                model: refSecurityType, as: 'refSec',
                attributes: ['securityTypeId', 'description'],
                include: [{
                    model: refAssetClass, as: 'refAs',
                    attributes: ['assetClassId', 'description'],
                }]
            },
            ]
        },
        {
            model: corporateRequestDetails,
            attributes: ['corporateRefDetailsId', 'reqValue'],
            include: [{
                model: corporateRefDetails, as: 'corpRef',
                attributes: ['columnName', 'columnReference']
            }]
        }
        ],
        where: {
            securityMasterId: data.securityMasterId,
            corporateRefId: data.corporateActionTypeId,
            recordDate: data.recordDate
        },
    }).then(response => {
        return response;
    }).catch(async (error) => {
        logger.loggerInstance.error(__filename, "getCorpActionFetchByDate", error);
        const response = await commonErrorHandler({ type: exceptionConstants.EXCEPTION_TYPE.ORM, data, error, fileName: __filename, methodName: "getCorpActionFetchByDate" });
        throw response;
    });

}
const getSecurityMasterId = async (data) => {
    logger.loggerInstance.trace(__filename, "getSecurityMasterId", logText.ENTRY_WITH_PARAM, data);
    return await securityMasterModel.findOne({
        where: {
            securitySymbol: data.securitySymbol
        },
        attributes: ['securityMasterId'],
        raw: true
    }).then(securityDetails => {
        logger.loggerInstance.trace(__filename, "getSecurityMasterId", logText.EXIT_WITH_PARAM, securityDetails);
        return securityDetails.securityMasterId
    }).catch(async (error) => {
        const response = await commonErrorHandler({ type: exceptionConstants.EXCEPTION_TYPE.ORM, data, error, fileName: __filename, methodName: 'getSecurityMasterId' });
        return response;
    });
}
const updateSecurityMasterStatus = async (data) => {
    logger.loggerInstance.trace(__filename, "updateSecurityMasterStatus", logText.ENTRY_WITH_PARAM, data);
    let securityMasterData = await getSecurityDetailsBySecurityId(data.securityMasterId);
    let param = {};
    param.securityStatusId = data.statusToBeChanged
    param.existingSecurityStatusId = securityMasterData.securityStatusId
    const [updateStatus, securityStatus] = await securityMasterModel.update(param,
        {
            where: {
                securityMasterId: data.securityMasterId
            },
            raw: true,
            returning: true
        }).catch(async (error) => {
            const response = await commonErrorHandler({ type: exceptionConstants.EXCEPTION_TYPE.ORM, data, error, fileName: __filename, methodName: "updateSecurityMasterStatus" });
            return ['', response];
        });
    logger.loggerInstance.trace(__filename, "updateSecurityMasterStatus", logText.EXIT_WITH_PARAM, securityStatus);
    return securityStatus
}
const getDpAcctInfo = async (data) => {
    logger.loggerInstance.trace(__filename, "getDpAcctInfo", logText.ENTRY_WITH_PARAM, data)
    let response;
    response = await getDpAcctDetails(data);
    response = response ? response : "";
    logger.loggerInstance.trace(__filename, "getDpAcctInfo", logText.EXIT_WITH_PARAM, response);
    return response;
}
const getUserBankAccountDetails = async (data) => {
    logger.loggerInstance.trace(__filename, "getUserBankAccountDetails", logText.ENTRY_WITH_PARAM, data);
    let whereParam = data;
    dpAccount.belongsTo(userBankAccount, { foreignKey: 'userBankAccountId' })
    return dpAccount.findOne({
        where: whereParam,
        include: [{
            model: userBankAccount,
            attributes: ['accountNumber', 'bankAccountType'],
        }],

        raw: true
    }).then(userBankDetails => {
        userBankDetails.accountNumber = userBankDetails['user_bank_account.accountNumber']
        userBankDetails.bankAccountType = userBankDetails['user_bank_account.bankAccountType']
        logger.loggerInstance.trace(__filename, "getUserBankAccountDetails", logText.EXIT_WITH_PARAM, userBankDetails);
        return userBankDetails;
    }).catch(async (error) => {
        const response = await commonErrorHandler({ type: exceptionConstants.EXCEPTION_TYPE.ORM, data, error, fileName: __filename, methodName: "getUserBankAccountDetails" });
        return response;
    });
}
module.exports = {
    corporateActionDao,
    saveEachCorporateReq,
    saveCorporateReqDetails,
    getCorporateRefDetails,
    createCorporateActionRecord,
    listOfInvestorsDao,
    getCorporateActionRecord,
    getCorporateRequestDetails,
    updateCorporateActionRecord,
    retrieveMarketLtpDataDao,
    corporateActionDetail,
    updateRecordChangeRequest,
    // approvedDetailDAO,
    reformCorporateActionRecord,
    corporateActionDates,
    // updateCorporateRequestDao,
    // viewCorporateRequestDetails,
    updatecorporateActionRecordStatusData,
    getCorpActionFetchByDate,
    getSecurityMasterId,
    retrieveMarketClosePrice,
    updateCorporateRequestUploadStatusData,
    updateSecurityMasterStatus,
    getDpAcctInfo,
    retreiveCorporateRequestDetails,
    retrieveCaRecordDetails,
    getUserBankAccountDetails
}