import axios from "axios";
import xlsx from "xlsx";
const json2csv = require("json2csv").parse;

//For Common Single Page XLSX and XLX ;
function generateXLSXAndXLSExport(
  data: any,
  columnNames: any,
  format: any,
  sheetName: any
) {
  try {
    const ws = xlsx.utils.aoa_to_sheet([columnNames]);

    data.forEach((item: any) => {
      const row = columnNames.map((columnName: any) => item[columnName]);
      xlsx.utils.sheet_add_aoa(ws, [row], { origin: -1 });
    });

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, sheetName);

    const buffer = xlsx.write(wb, { bookType: format, type: "buffer" });
    return buffer;
  } catch (error) {
    console.error(`Error generating ${format} export:`, error);
    throw error;
  }
}

//For Common multiple page XLSX and XLX ;
function generateMultipleXLSXAndXLSXExport(
  parentData: any,
  parentColumnNames: any,
  childData: any,
  childColumnNames: any,
  format: any,
  parentSheetName: any,
  childSheetName: any
) {
  try {
    const aspWs = xlsx.utils.aoa_to_sheet([parentColumnNames]);

    parentData.forEach((item: any) => {
      const row = parentColumnNames.map((columnName: any) => item[columnName]);
      xlsx.utils.sheet_add_aoa(aspWs, [row], { origin: -1 });
    });

    const mechanicWs = xlsx.utils.aoa_to_sheet([childColumnNames]);

    childData.forEach((item: any) => {
      const row = childColumnNames.map((columnName: any) => item[columnName]);
      xlsx.utils.sheet_add_aoa(mechanicWs, [row], { origin: -1 });
    });

    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, aspWs, parentSheetName);
    xlsx.utils.book_append_sheet(wb, mechanicWs, childSheetName);

    const buffer = xlsx.write(wb, { bookType: format, type: "buffer" });
    return buffer;
  } catch (error) {
    console.error(`Error generating ${format} export:`, error);
    throw error;
  }
}

function generateCSVExport(data: any, columnNames: any) {
  try {
    //add options
    const options: any = {
      fields: columnNames,
    };
    // Use json2csv to convert data to CSV with specific fields
    const csvString = json2csv(data, options);
    const buffer = Buffer.from(csvString, "utf-8");

    return buffer;

    return buffer;
  } catch (error) {
    console.error("Error generating CSV export:", error);
    throw error;
  }
}

function generateMultipleCSVExport(
  parentData: any,
  parentColumnNames: any,
  childData: any,
  childColumnNames: any
) {
  try {
    // Add options for AspDetails
    const aspOptions: any = {
      fields: parentColumnNames,
    };
    // Convert AspDetails data to CSV with specific fields
    const aspCsvString = json2csv(parentData, aspOptions);

    // Add options for MechanicDetails
    const mechanicOptions: any = {
      fields: childColumnNames,
    };
    // Convert MechanicDetails data to CSV with specific fields
    const mechanicCsvString = json2csv(childData, mechanicOptions);

    // Convert CSV strings to Buffers
    const aspCsvBuffer = Buffer.from(aspCsvString);
    const mechanicCsvBuffer = Buffer.from(mechanicCsvString);

    // Return the Buffers
    return {
      aspCsvBuffer,
      mechanicCsvBuffer,
    };
  } catch (error) {
    console.error("Error generating CSV export:", error);
    throw error;
  }
}

async function createDataAsUser(url: any, data: any) {
  try {
    const response = await axios.post(url, data);
    return response.data;
  } catch (error: any) {
    throw new Error(`HTTP request failed: ${error.message}`);
  }
}

export {
  generateXLSXAndXLSExport,
  generateMultipleXLSXAndXLSXExport,
  generateCSVExport,
  generateMultipleCSVExport,
  createDataAsUser,
};
