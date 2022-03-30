'use strict';
//require('appoptics-apm')
const http = require('http');
const express = require("express");
const app = express();
const bodyParser = require('body-parser');
const config = require('./config');
const logs = require('./common/helpers/log/apiLogger');
const logger = require('./common/helpers/log/logger');
const cors = require('cors');
const { dbInstance } = require('./common/helpers/db');
const terminalLogger = require('./common/helpers/log/terminalLogger');
const { commonErrorHandler } = require('./exceptionManager/services/commonErrorHandler')
const exceptionConstants = require('./common/util/exceptionConstants');
const constants = require('./common/util/constants');
const { setApplicationConfigurations } = require('./adminManager/service/adminService')
const { verifyAuthToken } = require('./authentication/auth-middleware')
const { verifyRequestObjectData } = require('./authentication/objectSecurityValidation');
const { setSecurityConfiguration } = require('./userManager/service/loginService')
constants.REAL_TIME_NOTIFICATION.ALLOTMENT = config.RTN_ALLOTMENT;
constants.REAL_TIME_NOTIFICATION.CORPORATE_ACTION = config.RTN_CORPORATE_ACTION;
let allowedOrigins = config.API_MANAGER_URL;
const helmet = require('helmet');
app.use(helmet());
app.use(helmet.referrerPolicy());
app.use('/images', express.static('images'));
app.use('/sop', express.static('sop'));
app.use('/uploadedFiles', express.static('uploadedFiles'));
app.use('/contractNote', express.static('/root/BNX/ContractNote/Depository'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.raw({ limit: '100mb' }))
app.use(bodyParser.json({ limit: '50mb', extended: true }))
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }))

app.use(function (req, res, next) {
  let origin = req.headers.origin;
  if (allowedOrigins.indexOf(origin) > -1) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});
var corsOptions = {
  origin: allowedOrigins
}
app.use(cors(corsOptions));
let allowedMethods = ['GET', 'POST'];
app.use(function (req, res, next) {
  if (!allowedMethods.includes(req.method)) {
    return res.status(constants.STATUS_CODE.METHOD_NOT_FOUND).json({ "status": 'Method Not Allowed' });
  }
  next();
});
app.use(verifyAuthToken);
app.use(verifyRequestObjectData);
var httpsocket = http.createServer(app).listen(config.SERVER_PORT);
app.use(logs.requestId);
app.use(logs.morganlog);

//All request it will handle log (bunyan)
app.use((req, res, next) => {
  var log = logger.loggerInstance.child({ id: req.id, body: req.body }, true)
  log.info({ req: req })
  next();
});

// All response it will handle log (bunyan)
app.use(function (req, res, next) {
  function afterResponse() {
    res.removeListener('finish', afterResponse);
    res.removeListener('close', afterResponse);
    var log = logger.loggerInstance.child({ id: req.id }, true)
    log.info({ res: res }, 'response')
  }
  res.on('finish', afterResponse);
  res.on('close', afterResponse);
  next();
});


app.get('/info', function (req, res) {
  res.send({
    info: "This API was working"
  });
  logger.loggerInstance.trace("welcome");
});


dbInstance.authenticate()
  .then(() => {
    terminalLogger('DataBase: Database Connected.');
    setApplicationConfigurations();
    setSecurityConfiguration();
    logger.loggerInstance.info("SS_9003: Database Connected.");
  })
  .catch(err => {
    commonErrorHandler({ type: exceptionConstants.EXCEPTION_TYPE.DB });
    terminalLogger('Database: Error: ' + err);
    logger.loggerInstance.error(__filename, "DB", err);
  })

const tacoConsumer = require('./tacoManager/consumer/tacoConsumer');
const batchNotification = require('./batchNotificationManager/consumer/batchNotificationConsumer');
const payment = require('./paymentManager/consumer/paymentConsumer');
const paymentAck = require('./paymentManager/consumer/paymentAckConsumer');
const corporateActionAck = require('./corporateActionManager/consumer/corporateActionConsumer');

// //socket
let realtime = require('./common/helpers/socket');
var session = require('express-session');
var sessionMiddleware = session({
  secret: 'qwertyuiop',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: true }
});
realtime.connect(httpsocket, sessionMiddleware);
app.use(function (error, req, res, next) {
  if (error instanceof SyntaxError) {
    commonErrorHandler({ type: exceptionConstants.EXCEPTION_TYPE.URL_INPUT_DATA_SYNTAX, response: res, error });
  } else {
    next();
  }
});
logger.loggerInstance.info("SS_9006: Depository Service Started");
//Rest API Routes to controller
app.use('/depository/security', require('./securityManager/controllers/securityController'));
app.use('/depository/security', require('./securityManager/controllers/securityRegisterController'));
app.use('/depository/security', require('./securityManager/controllers/securityModificationController'));
app.use('/depository/securityStatus', require('./securityManager/controllers/securityStatusChangeController'));
app.use('/depository/securityTemplate', require('./securityManager/controllers/securityTemplateController'));
app.use('/depository/subscription', require('./subscriptionManager/controllers/subscriptionController'));
app.use('/depository/allotment', require('./allotmentManager/controllers/allotmentController'));
app.use('/depository/investor/onboard', require('./onBoardingManager/controllers/investorOnboardingController'));
app.use('/depository/investor/loginDpLinking', require('./onBoardingManager/controllers/loginDpLinkingController'));
app.use('/depository/investor/changedpStatus', require('./onBoardingManager/controllers/dpstatusChangeController'));
app.use('/depository/investor/modifyInvestor', require('./onBoardingManager/controllers/modifyInvestorController'));
app.use('/depository/investor', require('./onBoardingManager/controllers/investorController'));
app.use('/depository/agent', require('./onBoardingManager/controllers/agentOnboardingController'));
app.use('/depository/login', require('./userManager/controllers/loginController'));
app.use('/depository/admin', require('./adminManager/controller/adminController'));
app.use('/depository/admin', require('./notificationManager/controllers/notificationController'));
app.use('/depository/billing', require('./tariffManager/controllers/billingController'));
app.use('/depository/billing', require('./tariffManager/controllers/tariffController'));
app.use('/depository/billing', require('./tariffManager/controllers/defaultTariffController'));
app.use('/depository/billing', require('./depositoryBillingManager/controllers/billingPaymentController'));
app.use('/depository/agent/onboard', require('./onBoardingManager/controllers/agentOnboardingController'));
app.use('/depository/agent/changeAcctStatus', require('./onBoardingManager/controllers/agentStatusChangeController'));
app.use('/depository/agent/modifyAgent', require('./onBoardingManager/controllers/modifyAgentController'));
app.use('/depository', require('./tacoManager/controller/tacoController'));
app.use('/depository', require('./onBoardingManager/controllers/riskProfileController'));
app.use('/depository/applicationSettings', require('./adminManager/controller/holidayListController'));
app.use('/depository/agentMapping', require('./agentManager/controllers/agentController'));
app.use('/depository/agent/agentMapping', require('./agentManager/controllers/agentMappingController'));
app.use('/depository/corporateAction', require('./corporateActionManager/controllers/corporateActionController'));
app.use('/depository/billingConfiguration/feeName', require('./depositoryBillingManager/controllers/feeNameController'));
app.use('/depository/billingConfiguration', require('./depositoryBillingManager/controllers/depositoryBillingController'));
app.use('/depository/billingAdjustment', require('./depositoryBillingManager/controllers/billingAdjustmentController'));
app.use('/depository/achDetails', require('./depositoryBillingManager/controllers/achFileTransferController'));
app.use('/depository/bankDetails', require('./adminManager/controller/bankDetailsController'));
app.use('/depository/reconciliation', require('./reconciliationManager/securityReconManager/controllers/securityReconController'));
app.use((req, res, next) => {
  commonErrorHandler({ type: exceptionConstants.EXCEPTION_TYPE.URL_NOT_FOUND, response: res });
})