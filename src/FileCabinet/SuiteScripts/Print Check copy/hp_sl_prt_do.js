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
  "N/query",
], (
  nlRecord,
  nlConfig,
  nlRender,
  nlEmail,
  nlSearch,
  nlFormat,
  nlFile,
  runtime,
  query,
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
    var param0 = true; // replace with actual value
    var sql = `
  SELECT 
    "TRANSACTION".trandate AS trandate, 
    "TRANSACTION".entity AS entity, 
    "TRANSACTION".tranid AS tranid, 
    "TRANSACTION".trandisplayname AS trandisplayname, 
    "TRANSACTION"."TYPE" AS "TYPE", 
    "TRANSACTION".foreigntotal AS foreigntotal
  FROM 
    "TRANSACTION", 
    transactionLine
  WHERE 
    "TRANSACTION"."ID" = transactionLine."TRANSACTION"
    AND (
      "TRANSACTION"."TYPE" IN ('CustInvc') 
      AND transactionLine.createdfrom = ? 
      AND transactionLine.mainline = 'T' 
    )
`;


    if (request.method === "GET") {
      try {
        const transactionId = Number(request.parameters.ifid);
        const transactionType = request.parameters.custom_type;

        log.audit("Transaction Info", { transactionId, transactionType });
        // Load transaction record
        const so_record = nlRecord.load({
          type: nlRecord.Type.SALES_ORDER,
          id: Number(transactionId),
          isDynamic: false,
        });
        var inv_do_link = so_record.getValue({
          fieldId: 'custbody_hp_so_inv_relate'
        });
        // if (inv_do_link) {
        //   return;
        // }
        var results = runSuiteQLQuery(sql, [transactionId]);

        // ✅ Capture the first invoice tranid safely
        let firstInvoiceTranid = null;
        if (results.mappedResults && results.mappedResults.length > 0) {
          firstInvoiceTranid = results.mappedResults[0].tranid;
        }

        if (firstInvoiceTranid) {
          log.debug("Processing Invoice", firstInvoiceTranid);
        }

        so_record.setValue({
          fieldId: 'custbody_hp_so_inv_relate',
          value: firstInvoiceTranid,
          ignoreFieldChange: true
        });

        so_record.save();



        // Try render
        const pdfFile = nlRender.transaction({
          entityId: transactionId,
          printMode: nlRender.PrintMode.PDF,
          formId: 122,
        });

        response.writeFile({
          file: pdfFile,
          isInline: true,
        });
      } catch (e) {
        log.error("Error rendering transaction", e);
        response.write(`Error: ${e.name || e.message}`);
      }
    }
  };

  /**
     * Run a SuiteQL query with optional parameter
     * @param {string} sqlQuery - SuiteQL string
     * @param {Array} params - Array of query parameters
     * @param {number} pageSize - Optional page size for paged results (default 50)
     * @returns {Object} - Contains allResults, mappedResults, pagedResults
     */
  function runSuiteQLQuery(sqlQuery, params = [], pageSize = 50) {
    var output = {};

    // 1. Run normal query
    var resultSet = query.runSuiteQL({ query: sqlQuery, params: params });
    output.allResults = resultSet.results;
    output.allResults.forEach(r => log.debug('Row', r.values));

    // 2. Get mapped results
    output.mappedResults = resultSet.asMappedResults();
    log.debug('Mapped Results', output.mappedResults);

    // 3. Run as paged query
    var pagedResults = query.runSuiteQLPaged({ query: sqlQuery, params: params, pageSize: pageSize });
    output.pagedResults = [];
    for (var i = 0; i < pagedResults.pageRanges.length; i++) {
      var page = pagedResults.fetch(i);
      log.debug('Page ' + page.pageRange.index, 'Size: ' + page.pageRange.size);
      output.pagedResults.push(...page.data.results);
    }

    // 4. Run paged query with iterator
    var iterResults = [];
    var resultIterator = pagedResults.iterator();
    resultIterator.each(function (page) {
      var pageIterator = page.value.data.iterator();
      pageIterator.each(function (row) {
        iterResults.push(row.value.values);
        return true;
      });
      return true;
    });
    output.iteratorResults = iterResults;

    return output;
  }

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
