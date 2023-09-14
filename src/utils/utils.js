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

export function areDatesEqual(date1, date2) {
  const newDate1 = new Date('' + date1);
  const newDate2 = new Date('' + date2);
  return (
    newDate1.getFullYear() === newDate2.getFullYear() &&
    newDate1.getMonth() === newDate2.getMonth() &&
    newDate1.getDate() === newDate2.getDate()
  );
}

export function formatDateToLocalString(date) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}
