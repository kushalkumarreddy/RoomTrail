import apiClient from './api';

/**
 * Triggers a native browser file download from a Blob
 */
export function triggerBlobDownload(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }, 150);
}

/**
 * Extract filename from content-disposition header if present
 */
function extractFilename(contentDisposition, fallback) {
  if (!contentDisposition) return fallback;
  const match = contentDisposition.match(/filename=["']?([^"';]+)["']?/i);
  return match && match[1] ? match[1].trim() : fallback;
}

export const exportService = {
  /**
   * Export Trip-Level CSV
   */
  async exportTripsCsv({ startDate, endDate, includeStops = true } = {}) {
    const params = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    params.includeStops = includeStops;

    const response = await apiClient.get('/travel-history/export/csv', {
      params,
      responseType: 'blob',
    });

    const fallback = `roomtrail_travel_history_${new Date().toISOString().slice(0, 10)}.csv`;
    const filename = extractFilename(response.headers?.['content-disposition'], fallback);
    triggerBlobDownload(response.data, filename);
    return { filename, size: response.data.size };
  },

  /**
   * Export Actual Recorded Route Points CSV
   */
  async exportRoutePointsCsv({ startDate, endDate } = {}) {
    const params = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;

    const response = await apiClient.get('/travel-history/export/route-points', {
      params,
      responseType: 'blob',
    });

    const fallback = `roomtrail_route_points_${new Date().toISOString().slice(0, 10)}.csv`;
    const filename = extractFilename(response.headers?.['content-disposition'], fallback);
    triggerBlobDownload(response.data, filename);
    return { filename, size: response.data.size };
  },

  /**
   * Export Travel History PDF Report
   */
  async exportTravelHistoryPdf({ startDate, endDate, includeStops = true } = {}) {
    const params = {};
    if (startDate) params.startDate = startDate;
    if (endDate) params.endDate = endDate;
    params.includeStops = includeStops;

    const response = await apiClient.get('/travel-history/export/pdf', {
      params,
      responseType: 'blob',
    });

    const fallback = `roomtrail_travel_history_${new Date().toISOString().slice(0, 10)}.pdf`;
    const filename = extractFilename(response.headers?.['content-disposition'], fallback);
    triggerBlobDownload(response.data, filename);
    return { filename, size: response.data.size };
  },
};

export default exportService;
