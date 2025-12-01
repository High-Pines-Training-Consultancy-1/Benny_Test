/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */

define([
  "N/record",
  "N/config",
  "N/render",
  "N/email",
  "N/search",
  "N/format",
  "N/file",
  "N/runtime",
], (
  nlRecord,
  nlConfig,
  nlRender,
  nlEmail,
  nlSearch,
  nlFormat,
  nlFile,
  runtime
) => {
  //
  //  Define constant value
  //
  const SO_PDF_TEMPLATE_ID = "CUSTTMPL_HAJRIS_CHECK_PRINOUT";

  //
  //  Get Function defined
  //
  const getFunction = (context) => {
    const request = context.request;
    const response = context.response;
    //
    //  Parameters:
    //  1. Transaction Internal Id
    //  2. Transaction Type
    //
    var transactionInternalId = request.parameters?.ifid;
    var transactionType = request.parameters?.custom_type;
    var subsidiaryId = request.parameters.subsidiaryId;

    log.debug("request.parameters", request.parameters);
    if (!transactionInternalId) {
      log.error("ERROR_TranId_Empty", transactionInternalId);
      return;
    }

    if (!transactionType) {
      log.error("ERROR_TranType_Empty", transactionType);
      return;
    }

    try {
      const transactionRecord = nlRecord.load({
        type: transactionType,
        id: transactionInternalId,
      });

      // const subsiRecord = nlRecord.load({
      //   type: nlRecord.Type.SUBSIDIARY,
      //   id: subsidiaryId,
      // });
      // log.debug("subsiRecord", subsiRecord);

      //
      //  Generate required information
      //
      const companyInformation = getCompanyInformation();
      const subsidiaryFieldsData = getSubsidiaryInformation(subsidiaryId);
      const headerFieldsData = getRecordFieldsData(transactionRecord);
      const sublistFieldsData = getSublistFieldsData(
        transactionRecord,
        "item",
        transactionType,
        transactionInternalId
      );
      const sublistFieldsDataExpense = getSublistFieldsData2(
        transactionRecord,
        "expense",
        transactionType,
        transactionInternalId
      );

      log.debug("sublistFieldsData", sublistFieldsData);
      log.debug("sublistFieldsDataExpense", sublistFieldsDataExpense);

      //
      //	Generate XML data
      //

      //	Header
      var xmlStr =
        '<?xml version="1.0"?><!DOCTYPE pdf PUBLIC "-//big.faceless.org//report" "report-1.1.dtd">';
      xmlStr += "<pdf>";

      const dataSource = {
        companyinformation: companyInformation,
        subsidiary: subsidiaryFieldsData,
        record: headerFieldsData,
        item: sublistFieldsData,
        expense: sublistFieldsDataExpense,
      };

      //
      //	Create render object and add to XML doc
      //
      const renderer = nlRender.create();
      renderer.setTemplateByScriptId(SO_PDF_TEMPLATE_ID);
      renderer.addCustomDataSource({
        alias: "ds",
        format: nlRender.DataSource.OBJECT,
        data: dataSource,
      });
      xmlStr += renderer
        .renderAsString()
        .replace(/&(?!(#\\d+|\\w+);)/g, "&amp;$1");
      xmlStr = xmlStr.replace(/&nbsp;/g, "&#160;");
      //	End of document
      xmlStr += "</pdf>";

      const pdfFile = nlRender.xmlToPdf({
        xmlString: xmlStr,
      });

      response.writeFile({
        file: pdfFile,
        isInline: true,
      });
    } catch (e) {
      log.error(e.name, e);
      //handleErrorIfAny(e, transactionInternalId, transactionType);
    }
  };

  /**
   * To replace next line by replacing "\n" to "<br />"
   *
   * @param {string} value - The value need to be replace
   * @returns ReplacedValue
   */
  const replaceNextLine = (value) => {
    if (value) value = value.replaceAll("\n", "<br />");
    return value;
  };

  /**
   * Round number to decimal places else 2 decimal
   *
   * @param {number} value - The value need to be decimise
   * @returns RoundedNumber
   */
  const roundNumber = (value) => {
    if (!value) return "";
    const decimalIndex = value.toString().indexOf(".");
    var decimal =
      decimalIndex >= 0 ? value.toString().length - decimalIndex - 1 : 0;
    if (decimal == 0) decimal = 2;
    value = parseFloat(value).toFixed(decimal);
    log.debug("Amount - roundNumber", value);
    return value;
  };

  const extractAddress = (value) => {
    var indexOfn = value.indexOf("\n");
    var partOfValue = value.slice(indexOfn + 1);
    log.debug("partOfValue", partOfValue);
    return partOfValue;
  };

  const getTextValueFromIDExpense = (value) => {
    var finalValue;
    var indexOfAccountName;
    const accountSearch = nlSearch.create({
      type: "account",
      filters: [
        ["internalid", "anyof", value],
        "AND",
        ["type", "anyof", "Expense"],
      ],
      columns: ["name", "displayname", "type", "balance"],
    });
    const runAccountSearch = accountSearch.run().getRange(0, 1);
    log.debug("runAccountSearch.length", runAccountSearch.length);
    if (runAccountSearch.length > 0) {
      finalValue = runAccountSearch[0].getValue("displayname");
    }
    indexOfAccountName = finalValue.indexOf(" ");
    log.debug("indexOfAccountName", indexOfAccountName);
    partOfAccount = finalValue.slice(0, indexOfAccountName + 1);
    return finalValue;
  };

  const getPhoneValue = (value) => {
    var finalValue;
    var vendorSearch = nlSearch.create({
      type: "vendor",
      filters: [["internalid", "is", value]],
      columns: ["phone", "fax", "terms"],
    });
    const runVendorSearch = vendorSearch.run().getRange(0, 1);
    if (runVendorSearch.length > 0) {
      finalValue = runVendorSearch[0].getValue("phone");
    }
    return finalValue;
  };

  const getFaxValue = (value) => {
    var finalValue;
    var vendorSearch = nlSearch.create({
      type: "vendor",
      filters: [["internalid", "is", value]],
      columns: ["phone", "fax", "terms"],
    });
    const runVendorSearch = vendorSearch.run().getRange(0, 1);
    if (runVendorSearch.length > 0) {
      finalValue = runVendorSearch[0].getValue("fax");
    }
    return finalValue;
  };

  const getTermsValue = (value) => {
    var finalValue;
    var vendorSearch = nlSearch.create({
      type: "vendor",
      filters: [["internalid", "is", value]],
      columns: ["phone", "fax", "terms"],
    });
    const runVendorSearch = vendorSearch.run().getRange(0, 1);
    if (runVendorSearch.length > 0) {
      finalValue = runVendorSearch[0].getText("terms");
    }
    return finalValue;
  };

  const getbilladd = (value) => {
    var finalValue;
    const SearchDocDate = nlSearch.create({
      type: nlSearch.Type.TRANSACTION,
      filters: [
        ["internalid", "anyof", value],
        // 'AND',
        // ['type', 'anyof', 'SalesOrd'],
      ],
      columns: ["billaddress"],
    });
    const runSearchDocDate = SearchDocDate.run().getRange(0, 1);
    if (runSearchDocDate.length > 0) {
      finalValue = runSearchDocDate[0].getValue("billaddress");
    }
    // var txt2 = finalValue.replaceAll("\n", "<br />");
    var txt2 = finalValue.replaceAll("\n", "<br />");
    log.debug("txt2", txt2);
    return txt2;
  };

  const getpaymentmethod = (value) => {
    var finalValue;
    const SearchDocDate = nlSearch.create({
      type: "salesorder",
      filters: [
        ["internalid", "anyof", value],
        "AND",
        ["type", "anyof", "SalesOrd"],
      ],
      columns: ["paymentoption"],
    });
    const runSearchDocDate = SearchDocDate.run().getRange(0, 1);
    if (runSearchDocDate.length > 0) {
      finalValue = runSearchDocDate[0].getText("paymentoption");
    }
    return finalValue;
  };

  const getsonum = (value) => {
    var finalValue;
    const SearchSOnumber = nlSearch.create({
      type: "itemfulfillment",
      filters: [
        ["type", "anyof", "ItemShip"],
        "AND",
        ["internalid", "anyof", value],
        "AND",
        ["mainline", "is", "T"],
      ],
      columns: ["createdfrom"],
    });
    const runSearchSOnumber = SearchSOnumber.run().getRange(0, 1);
    if (runSearchSOnumber.length > 0) {
      finalValue = runSearchSOnumber[0].getValue("createdfrom");
    }
    log.debug("finalValue", finalValue);
    return finalValue;
  };

  const getshipmethod = (value) => {
    var finalValue;
    const SearchDocDate = nlSearch.create({
      type: "shipitem",
      filters: [["internalid", "anyof", value]],
      columns: ["itemid"],
    });
    const runSearchDocDate = SearchDocDate.run().getRange(0, 1);
    if (runSearchDocDate.length > 0) {
      finalValue = runSearchDocDate[0].getValue("itemid");
    }
    return finalValue;
  };

  const getInvValue = (value) => {
    log.debug("value", value);
    var finalValue;
    const SearchDocDate = nlSearch.create({
      type: "invoice",
      filters: [
        ["type", "anyof", "CustInvc"],
        "AND",
        ["mainline", "is", "T"],
        "AND",
        ["createdfrom", "anyof", value],
      ],
      columns: ["tranid"],
    });
    const runSearchDocDate = SearchDocDate.run().getRange(0, 1);
    if (runSearchDocDate.length > 0) {
      finalValue = runSearchDocDate[0].getValue("tranid");
    }
    return finalValue;
  };

  const getOtherReferNo = (value) => {
    var finalValue;
    const SearchDocDate = nlSearch.create({
      type: "salesorder",
      filters: [
        ["internalid", "anyof", value],
        "AND",
        ["type", "anyof", "SalesOrd"],
      ],
      columns: ["otherrefnum"],
    });
    const runSearchDocDate = SearchDocDate.run().getRange(0, 1);
    if (runSearchDocDate.length > 0) {
      finalValue = runSearchDocDate[0].getText("otherrefnum");
    }
    log.debug("finalValue", finalValue);
    return finalValue;
  };

  const getDocDate = (value) => {
    var finalValue;
    const SearchDocDate = nlSearch.create({
      type: "transaction",
      filters: [["internalid", "anyof", value], "AND", ["mainline", "is", "T"]],
      columns: ["trandate"],
    });
    const runSearchDocDate = SearchDocDate.run().getRange(0, 1);
    if (runSearchDocDate.length > 0) {
      finalValue = runSearchDocDate[0].getValue("trandate");
    }
    return finalValue;
  };

  /**
   * Removes invalid XML characters from a string
   *
   * @param {string} str - a string containing potentially invalid XML characters (non-UTF8 characters, STX, EOX etc)
   * @param {boolean} removeDiscouragedChars - should it remove discouraged but valid XML characters
   * @return {string} a sanitized string stripped of invalid XML characters
   */
  const removeXmlInvalidChars = (value, removeDiscouragedChars) => {
    // remove everything forbidden by XML 1.0 specifications, plus the unicode replacement character U+FFFD
    var regex =
      /((?:[\0-\x08\x0B\f\x0E-\x1F\uFFFD\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]))/g;

    // ensure we have a string
    value = String(value || "").replace(regex, "");

    if (removeDiscouragedChars) {
      // remove everything discouraged by XML 1.0 specifications
      regex = new RegExp(
        "([\\x7F-\\x84]|[\\x86-\\x9F]|[\\uFDD0-\\uFDEF]|(?:\\uD83F[\\uDFFE\\uDFFF])|(?:\\uD87F[\\uDF" +
          "FE\\uDFFF])|(?:\\uD8BF[\\uDFFE\\uDFFF])|(?:\\uD8FF[\\uDFFE\\uDFFF])|(?:\\uD93F[\\uDFFE\\uD" +
          "FFF])|(?:\\uD97F[\\uDFFE\\uDFFF])|(?:\\uD9BF[\\uDFFE\\uDFFF])|(?:\\uD9FF[\\uDFFE\\uDFFF])" +
          "|(?:\\uDA3F[\\uDFFE\\uDFFF])|(?:\\uDA7F[\\uDFFE\\uDFFF])|(?:\\uDABF[\\uDFFE\\uDFFF])|(?:\\" +
          "uDAFF[\\uDFFE\\uDFFF])|(?:\\uDB3F[\\uDFFE\\uDFFF])|(?:\\uDB7F[\\uDFFE\\uDFFF])|(?:\\uDBBF" +
          "[\\uDFFE\\uDFFF])|(?:\\uDBFF[\\uDFFE\\uDFFF])(?:[\\0-\\t\\x0B\\f\\x0E-\\u2027\\u202A-\\uD7FF\\" +
          "uE000-\\uFFFF]|[\\uD800-\\uDBFF][\\uDC00-\\uDFFF]|[\\uD800-\\uDBFF](?![\\uDC00-\\uDFFF])|" +
          "(?:[^\\uD800-\\uDBFF]|^)[\\uDC00-\\uDFFF]))",
        "g"
      );

      value = value.replace(regex, "");
    }

    return value;
  };

  /**
   * To perform search to find specific column
   *
   * @param {string} searchType - Searching Type
   * @param {string} filterId - Filter column
   * @param {string} filterValue - Filter value
   * @param {string} column - Result column
   * @param {string|Enum} operator - Operator for that filter
   * @returns searchValue
   */
  const getValueByColumn = (
    searchType,
    filterId,
    filterValue,
    column,
    operator
  ) => {
    operator = operator ? operator : "anyof";

    const searchObj = nlSearch
      .create({
        type: searchType,
        filters: [[filterId, operator, filterValue]],
        columns: column,
      })
      .run()
      .getRange({ start: 0, end: 1 });

    var columnResult = "";
    if (searchObj.length > 0) {
      columnResult = searchObj[0].getValue(column);
    }

    return columnResult;
  };

  /**
   * Function to call to format the date to NetSuite format
   *
   * @param {Date} value - The accepted date
   * @returns formatted date
   */
  const formatDate = (value) => {
    if (value)
      value = nlFormat.format({
        value: value,
        type: nlFormat.Type.DATE,
      });
    return value;
  };

  /**
   * Generate header data
   *
   * @param {Object} recordObj - The transaction record object
   * @returns HeaderFieldsData
   */
  const getRecordFieldsData = (recordObj) => {
    const recordFields = recordObj.getFields();

    var fieldsData = {};
    for (const i in recordFields) {
      const field = recordFields[i];
      var value = recordObj.getValue(field);
      var value2 = recordObj.getText(field);
      if (!value) continue;

      if (field == "total" || field == "subtotal" || field == "taxtotal") {
        value = roundNumber(value);
      }

      if (field == "trandate" || field == "shipdate") {
        value = formatDate(value);
      }

      if (field == "shipaddress" || field == "billaddress") {
        value = replaceNextLine(value);
      }

      if (field == "billingaddress_text") {
        value = extractAddress(value);
      }

      if (field == "account") {
        log.debug("account", value);
        value = recordObj.getText(field);
        value2 = recordObj.getValue(field);
        var indexOfAccountName = value.indexOf(" ");
        log.debug("indexOfAccountName", indexOfAccountName);
        value = value.slice(indexOfAccountName + 1);
        fieldsData[field] = value;
        log.debug("account(after format)", value);
      }

      if (field == "initialentity") {
        value = getPhoneValue(value);
      }

      if (field == "entity") {
        value = getFaxValue(value);
      }

      if (field == "companyid") {
        value = getTermsValue(value);
      }

      if (field == "id") {
        value = getsonum(value);
      }

      if (field == "orderid") {
        value = getpaymentmethod(value);
      }

      if (field == "createdfrom") {
        // value = getDocDate(value);
        if (value) {
          value = getInvValue(value);
        }
      }

      if (field == "recordshipmethod") {
        value = getshipmethod(value);
      }

      if (field == "usertotal") {
        log.debug("usertotal", value);
        value = value.toFixed(2);
        log.debug("usertotal(after format)", value);
      }

      value = removeXmlInvalidChars(value, true);
      fieldsData[field] = value;
    }

    return fieldsData;
  };

  /**
   * Generate sublist data
   *
   * @param {Object} recordObj - The transaction record object
   * @param {string} sublistId - The sublist field id
   * @param {string} tranType - Transaction type
   * @param {string} tranId - Transaction internal id
   * @returns SublistLineData
   */
  const getSublistFieldsData = (recordObj, sublistId) => {
    sublistId = sublistId ? sublistId : "item";
    const sublistFields = recordObj.getSublistFields({
      sublistId: sublistId,
    });
    const sublistLines = recordObj.getLineCount({
      sublistId: sublistId,
    });

    var itemData = [];
    for (var i = 0; i < sublistLines; i++) {
      var itemValue = {};
      sublistFields.forEach((fieldId) => {
        var value = recordObj.getSublistValue({
          sublistId: sublistId,
          fieldId: fieldId,
          line: i,
        });

        if (fieldId == "item") {
          value = getValueByColumn("item", "internalid", value, "itemid");
        }

        if (fieldId == "orderdoc") {
          value = getOtherReferNo(value);
        }

        if (fieldId == "grossamt") {
          log.debug("grossamt", value);
          value = value.toFixed(2);
          log.debug("grossamt(after format)", value);
        }

        // if (fieldId == "itemdescription" ) {
        // 	value = replaceNextLine(value);
        // }

        if (fieldId == "inventorydetailavail" && value == "T") {
          itemValue["inventorydetail"] = new Array();
          const inventoryDetail = recordObj.getSublistSubrecord({
            sublistId: sublistId,
            fieldId: "inventorydetail",
            line: i,
          });
          const inventoryDetailResults = getInventoryDetail(inventoryDetail);
          itemValue["inventorydetail"] = inventoryDetailResults;
        }

        if (value) {
          value = removeXmlInvalidChars(value, true);
          itemValue[fieldId] = value;
        }
      });
      itemData.push(itemValue);
    }

    return itemData;
  };

  /**
   * Generate sublist data
   *
   * @param {Object} recordObj - The transaction record object
   * @param {string} sublistId - The sublist field id
   * @param {string} tranType - Transaction type
   * @param {string} tranId - Transaction internal id
   * @returns SublistLineData
   */
  const getSublistFieldsData2 = (recordObj, sublistId) => {
    sublistId = sublistId ? sublistId : "expense";
    const sublistFields = recordObj.getSublistFields({
      sublistId: sublistId,
    });
    const sublistLines = recordObj.getLineCount({
      sublistId: sublistId,
    });

    var itemData = [];
    log.debug("sublistLines - expense ", sublistLines);
    for (var i = 0; i < sublistLines; i++) {
      var itemValue = {};
      sublistFields.forEach((fieldId) => {
        var value = recordObj.getSublistValue({
          sublistId: sublistId,
          fieldId: fieldId,
          line: i,
        });
        var value2 = recordObj.getSublistText({
          sublistId: sublistId,
          fieldId: fieldId,
          line: i,
        });

        if (fieldId == "account") {
          value = getValueByColumn("account", "internalid", value, "displayname");
        }

        if (value) {
          value = removeXmlInvalidChars(value, true);
          itemValue[fieldId] = value;
        }
      });
      itemData.push(itemValue);
    }
    var lenght = itemData.length;
    log.debug("lenght", lenght);

    return itemData;
  };

  /**
   * Generate sublist data
   *
   * @param {Object} recordObj - The transaction record object
   * @param {string} sublistId - The sublist field id
   * @param {string} tranType - Transaction type
   * @param {string} tranId - Transaction internal id
   * @returns SublistLineData
   */
  const getSublistFieldsDataExpense = (recordObj, sublistId) => {
    sublistId = sublistId ? sublistId : "expense";
    const sublistFields = recordObj.getSublistFields({
      sublistId: sublistId,
    });
    const sublistLines = recordObj.getLineCount({
      sublistId: sublistId,
    });

    var expenseData = [];
    for (var i = 0; i < sublistLines; i++) {
      var expenseValue = {};
      sublistFields.forEach((fieldId) => {
        var value = recordObj.getSublistValue({
          sublistId: sublistId,
          fieldId: fieldId,
          line: i,
        });

        if (fieldId == "expense") {
          value = getValueByColumn("expense", "internalid", value, "expenseid");
        }

        if (fieldId == "grossamt") {
          log.debug("grossamt", value);
          value = value.toFixed(2);
          log.debug("grossamt(after format)", value);
        }

        if (fieldId == "account") {
          log.debug("account", value);
          value = recordObj.getText(fieldId);
          expenseData[fieldId] = value;
          log.debug("account(after format)", value);
        }

        if (fieldId == "categoryexpaccount") {
          log.debug("categoryexpaccount", value);
          value = getTextValueFromIDExpense(value);
          log.debug("categoryexpaccount(after format)", value);
        }

        if (value) {
          value = removeXmlInvalidChars(value, true);
          expenseValue[fieldId] = value;
        }
      });
      expenseData.push(expenseValue);
    }

    return expenseData;
  };

  /**
   * To get inventory detail lines value
   *
   * @param {Object} invDetailRecord - Inventory Detail record at current line
   * @returns inventorydetail record
   */
  const getInventoryDetail = (invDetailRecord) => {
    const inventoryDetailRecord = new Array();
    const sublistFields = invDetailRecord.getSublistFields({
      sublistId: "inventoryassignment",
    });

    const lineCount = invDetailRecord.getLineCount({
      sublistId: "inventoryassignment",
    });

    for (var i = 0; i < lineCount; i++) {
      var sublistField = {};
      sublistFields.forEach((fieldId) => {
        var value = invDetailRecord.getSublistValue({
          sublistId: "inventoryassignment",
          fieldId: fieldId,
          line: i,
        });

        if (value) {
          sublistField[fieldId] = value;
        }
      });
      inventoryDetailRecord.push(sublistField);
    }

    return inventoryDetailRecord;
  };

  /**
   * Get company information
   *
   * @returns CompanyInformation
   */
  const getCompanyInformation = () => {
    const companyObj = nlConfig.load({
      type: nlConfig.Type.COMPANY_INFORMATION,
    });

    var companyInformation = {};
    const companyFields = companyObj.getFields();
    for (const i in companyFields) {
      const field = companyFields[i];
      var value = companyObj.getValue(field);

      //   if (field == "mainaddress_text") {
      //     value = replaceNextLine(value);
      //   }

      value = removeXmlInvalidChars(value, true);
      companyInformation[field] = value;
    }

    return companyInformation;
  };

  /**
   * Get Subsidiary information
   *
   * @returns subsidiaryFieldsData
   */
  const getSubsidiaryInformation = (subsidiaryId) => {
    var subsidiaryFieldsData = {};
    var subsidiarySearchFilters = [["internalid", "anyof", subsidiaryId]];
    var subsidiarySearchColName = nlSearch.createColumn({
      name: "namenohierarchy",
      sort: nlSearch.Sort.ASC,
    });
    var subsidiarySearchColSubNavSearchableSubsidiaryLogo =
      nlSearch.createColumn({ name: "custrecord_subnav_subsidiary_logo" });
    var subsidiarySearchColAddress1 = nlSearch.createColumn({
      name: "address1",
    });
    var subsidiarySearchColAddress2 = nlSearch.createColumn({
      name: "address2",
    });
    var subsidiarySearchColZip = nlSearch.createColumn({ name: "zip" });
    var subsidiarySearchColCity = nlSearch.createColumn({ name: "city" });
    var subsidiarySearchColCountry = nlSearch.createColumn({ name: "country" });
    var subsidiarySearchColAddressState = nlSearch.createColumn({
      name: "state",
      join: "address",
    });
    var subsidiarySearch = nlSearch.create({
      type: "subsidiary",
      filters: subsidiarySearchFilters,
      columns: [
        subsidiarySearchColName,
        subsidiarySearchColSubNavSearchableSubsidiaryLogo,
        subsidiarySearchColAddress1,
        subsidiarySearchColAddress2,
        subsidiarySearchColZip,
        subsidiarySearchColCity,
        subsidiarySearchColCountry,
        subsidiarySearchColAddressState,
      ],
    });

    var subsidiarySearchPagedData = subsidiarySearch.runPaged({
      pageSize: 1000,
    });
    for (var i = 0; i < subsidiarySearchPagedData.pageRanges.length; i++) {
      var subsidiarySearchPage = subsidiarySearchPagedData.fetch({ index: i });
      subsidiarySearchPage.data.forEach(function (result) {
        var name = result.getValue(subsidiarySearchColName);
        var subNavSearchableSubsidiaryLogo = result.getValue(
          subsidiarySearchColSubNavSearchableSubsidiaryLogo
        );
        var logo_url = getFileUrl(subNavSearchableSubsidiaryLogo);
        var address1 = result.getValue(subsidiarySearchColAddress1);
        var address2 = result.getValue(subsidiarySearchColAddress2);
        var zip = result.getValue(subsidiarySearchColZip);
        var city = result.getValue(subsidiarySearchColCity);
        var country = result.getValue(subsidiarySearchColCountry);
        var state = result.getValue(subsidiarySearchColAddressState);

        subsidiaryFieldsData["name"] = removeXmlInvalidChars(name, true);
        subsidiaryFieldsData["logo"] = removeXmlInvalidChars(logo_url, true);
        subsidiaryFieldsData["address1"] = removeXmlInvalidChars(
          address1,
          true
        );
        subsidiaryFieldsData["address2"] = removeXmlInvalidChars(
          address2,
          true
        );
        subsidiaryFieldsData["zip"] = removeXmlInvalidChars(zip, true);
        subsidiaryFieldsData["city"] = removeXmlInvalidChars(city, true);
        subsidiaryFieldsData["country"] = removeXmlInvalidChars(country, true);
        subsidiaryFieldsData["state"] = removeXmlInvalidChars(state, true);
      });
    }
    const logo_2_id = 5915;
    var logo_url_2 = getFileUrl(logo_2_id);
    subsidiaryFieldsData["logo_2"] = removeXmlInvalidChars(logo_url_2, true);
    return subsidiaryFieldsData;
  };

  /**
   * Function to be executed to retrieve file url
   *
   * @param {string} fileId - Internalid of the file
   * @returns return file url
   */
  const getFileUrl = (fileId) => {
    if (!fileId) return "";

    var url = "";
    const fileObj = nlFile.load({
      id: fileId,
    });

    if (fileObj.url) {
      url = fileObj.url;
    }

    return url;
  };

  /**
   * Defines the Suitelet script trigger point.
   * @param {Object} scriptContext
   * @param {ServerRequest} scriptContext.request - Incoming request
   * @param {ServerResponse} scriptContext.response - Suitelet response
   * @since 2015.2
   */
  const onRequest = (scriptContext) => {
    if (scriptContext.request.method === "GET") {
      getFunction(scriptContext);

      const remainingUsage = runtime.getCurrentScript().getRemainingUsage();
      log.audit("Remaining Governance Units", remainingUsage);
    }
  };

  return { onRequest };
});
