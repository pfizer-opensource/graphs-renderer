export async function readJsonFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('The uploaded file is empty. Please upload a valid JSON file.'));
    } else if (!file.type.includes('json')) {
      reject(new Error('Invalid file type. Please upload a valid JSON file.'));
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          resolve(data);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsText(file);
    }
  });
}

export function addDaysToDate(date, noOfDays) {
  return new Date(date.getTime() + noOfDays * (1000 * 3600 * 24));
}

export function getNoOfDaysBetweenDates(startDate, finalDate) {
  return (finalDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24);
}
