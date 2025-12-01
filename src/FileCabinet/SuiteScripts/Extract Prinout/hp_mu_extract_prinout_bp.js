/**
 * @NApiVersion 2.1
 * @NScriptType MassUpdateScript
 */
define(["N/error", "N/record", "N/runtime", "N/search", "N/render"], 
(error, record, runtime, search, render) => {

  const each = (params) => {
    try {
      // Load transaction record to get document number (tranid)
      let rec = record.load({
        type: params.type,
        id: params.id
      });

      let docNumber = rec.getValue({ fieldId: 'tranid' });

      // Render the transaction as PDF
      let pdfFile = render.transaction({
        entityId: params.id,
        printMode: render.PrintMode.PDF,
      });

      // Save PDF to File Cabinet
      pdfFile.folder = 100361; // Replace with your folder internal ID
      pdfFile.name = `Bill_Payment_${docNumber}.pdf`; // Use document number
      let fileId = pdfFile.save();

      log.debug("PDF Saved", `Bill_Payment_: ${docNumber}, File ID: ${fileId}`);
    } catch (e) {
      log.error(
        "Error rendering Bill_Payment_",
        `Record ID: ${params.id}, Error: ${e.message}`
      );
    }

    // Governance tracking
    let remaining = runtime.getCurrentScript().getRemainingUsage();
    log.audit("Governance Check", `Record ID: ${params.id}, Remaining Units: ${remaining}`);
  };

  return { each };
});
