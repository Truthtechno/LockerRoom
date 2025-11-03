import * as XLSX from 'xlsx';

export interface ExportOptions {
  period?: string;
  includeCharts?: boolean;
  dataGranularity?: 'summary' | 'detailed' | 'both';
  format?: 'excel' | 'excel-data-only' | 'csv';
}

export interface ChartData {
  type: 'line' | 'bar' | 'pie' | 'area';
  title: string;
  data: any[];
  dataKey?: string;
  xKey?: string;
  yKey?: string;
  series?: Array<{ name: string; dataKey: string; color?: string }>;
}

/**
 * Generate Excel workbook with professional formatting
 */
export function generateExcelWorkbook(
  dataSheets: Array<{ name: string; data: any[]; summary?: any }>,
  charts?: ChartData[],
  options: ExportOptions = {}
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // Add each data sheet
  dataSheets.forEach(({ name, data, summary }) => {
    if (!data || data.length === 0) {
      // Create empty sheet with header
      const ws = XLSX.utils.json_to_sheet([{ message: 'No data available' }]);
      XLSX.utils.book_append_sheet(wb, ws, name);
      return;
    }

    // Create worksheet from data
    const ws = XLSX.utils.json_to_sheet(data);

    // Apply formatting
    applyExcelFormatting(ws, data, summary);

    // Add to workbook
    XLSX.utils.book_append_sheet(wb, ws, name);
  });

  // Add charts sheet if charts are provided and enabled
  if (options.includeCharts && charts && charts.length > 0) {
    // For now, we'll add chart data as tables
    // In a full implementation, we'd embed chart images or use ExcelJS for native charts
    const chartsSheet = XLSX.utils.json_to_sheet(charts.map(chart => ({
      Chart: chart.title,
      Type: chart.type,
      'Data Points': chart.data.length,
    })));
    XLSX.utils.book_append_sheet(wb, chartsSheet, 'Charts');
  }

  return wb;
}

/**
 * Apply professional formatting to Excel worksheet
 */
function applyExcelFormatting(ws: XLSX.WorkSheet, data: any[], summary?: any): void {
  if (!ws['!ref']) return;

  const range = XLSX.utils.decode_range(ws['!ref']);

  // Set column widths
  const cols: Array<{ wch: number }> = [];
  for (let col = range.s.c; col <= range.e.c; col++) {
    const header = XLSX.utils.encode_cell({ r: 0, c: col });
    const headerValue = ws[header]?.v || '';
    const maxLength = Math.max(
      headerValue.toString().length,
      ...data.slice(0, 100).map((row: any, idx: number) => {
        const cell = XLSX.utils.encode_cell({ r: idx + 1, c: col });
        const value = ws[cell]?.v;
        return value ? value.toString().length : 0;
      })
    );
    cols.push({ wch: Math.min(Math.max(maxLength + 2, 10), 50) });
  }
  ws['!cols'] = cols;

  // Enable autofilter
  ws['!autofilter'] = { ref: ws['!ref'] };

  // Style header row
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    if (ws[cellAddress]) {
      ws[cellAddress].s = {
        font: { bold: true, sz: 12, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "4472C4" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
          top: { style: "thin", color: { rgb: "000000" } },
          bottom: { style: "thin", color: { rgb: "000000" } },
          left: { style: "thin", color: { rgb: "000000" } },
          right: { style: "thin", color: { rgb: "000000" } },
        },
      };
    }
  }

  // Freeze header row (Note: xlsx library has limited freeze support, this may not work in all Excel versions)
  // Alternative: Use view options instead
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
  
  // Set view options for better Excel experience
  if (!ws['!views']) {
    ws['!views'] = [{}];
  }
  if (ws['!views'][0]) {
    ws['!views'][0].state = 'frozen';
    ws['!views'][0].ySplit = 1;
  }
}

/**
 * Download Excel file
 */
export function downloadExcelFile(workbook: XLSX.WorkBook, filename: string): void {
  XLSX.writeFile(workbook, filename);
}

/**
 * Export current tab data
 */
export async function exportCurrentTab(
  tabName: string,
  period: string,
  apiEndpoint: string,
  options: ExportOptions = {}
): Promise<void> {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(`${apiEndpoint}?period=${period}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch ${tabName} data`);
    }

    const data = await response.json();

    // Transform data based on endpoint
    let exportData: any[] = [];
    let sheetName = tabName;

    if (apiEndpoint.includes('/export/users')) {
      // Flatten user data for Excel
      exportData = (data.users || []).map((user: any) => ({
        'User ID': user.id,
        'Name': user.name || 'N/A',
        'Email': user.email || 'N/A',
        'Role': user.role || 'N/A',
        'School': user.schoolName || 'N/A',
        'Phone': user.phone || 'N/A',
        'Created Date': user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A',
        'Last Active': user.lastActive ? new Date(user.lastActive).toLocaleDateString() : 'Never',
        'Grade': user.grade || (user.role === 'student' ? 'N/A' : ''),
        'Position': user.position || (['student', 'school_admin'].includes(user.role) ? 'N/A' : ''),
        'Sport': user.sport || (user.role === 'student' ? 'N/A' : ''),
        'Role Number': user.roleNumber || (user.role === 'student' ? 'N/A' : ''),
      }));
      sheetName = 'Users';
    } else if (apiEndpoint.includes('/export/schools')) {
      // Flatten school data
      exportData = (data.schools || []).map((school: any) => ({
        'School ID': school.id,
        'Name': school.name || 'N/A',
        'Address': school.address || 'N/A',
        'Contact Email': school.contactEmail || 'N/A',
        'Contact Phone': school.contactPhone || 'N/A',
        'Payment Amount': `$${Number(school.paymentAmount || 0).toFixed(2)}`,
        'Frequency': school.paymentFrequency || 'N/A',
        'Status': school.isActive ? 'Active' : 'Inactive',
        'Expires': school.subscriptionExpiresAt ? new Date(school.subscriptionExpiresAt).toLocaleDateString() : 'N/A',
        'Last Payment': school.lastPaymentDate ? new Date(school.lastPaymentDate).toLocaleDateString() : 'N/A',
        'Max Students': school.maxStudents || 0,
        'Current Students': school.studentCount || 0,
        'Admins': school.adminCount || 0,
        'Posts': school.postCount || 0,
        'Created Date': school.createdAt ? new Date(school.createdAt).toLocaleDateString() : 'N/A',
      }));
      sheetName = 'Schools';
    } else if (apiEndpoint.includes('/export/posts')) {
      // Flatten post data with engagement
      exportData = (data.posts || []).map((post: any) => ({
        'Post ID': post.id,
        'Date': post.createdAt ? new Date(post.createdAt).toLocaleDateString() : 'N/A',
        'Student': post.studentName || 'N/A',
        'School': post.schoolName || 'N/A',
        'Type': post.mediaType || 'image',
        'Caption': post.caption || 'N/A',
        'Likes': post.engagement?.likes || 0,
        'Comments': post.engagement?.comments || 0,
        'Views': post.engagement?.views || 0,
        'Saves': post.engagement?.saves || 0,
        'Total Engagement': post.engagement?.total || 0,
        'Media URL': post.mediaUrl || 'N/A',
      }));
      sheetName = 'Posts';
    } else if (apiEndpoint.includes('/export/engagement')) {
      // Engagement has multiple arrays - combine them
      exportData = [
        ...(data.engagement?.likes || []).map((l: any) => ({
          'Action Type': 'Like',
          'Date': l.date ? new Date(l.date).toLocaleDateString() : 'N/A',
          'User': l.user || 'N/A',
          'User Role': l.userRole || 'N/A',
          'Student': l.student || 'N/A',
          'School': l.school || 'N/A',
          'Post Type': l.postType || 'N/A',
          'Post ID': l.postId || 'N/A',
        })),
        ...(data.engagement?.comments || []).map((c: any) => ({
          'Action Type': 'Comment',
          'Date': c.date ? new Date(c.date).toLocaleDateString() : 'N/A',
          'User': c.user || 'N/A',
          'User Role': c.userRole || 'N/A',
          'Comment': c.comment || 'N/A',
          'Student': c.student || 'N/A',
          'School': c.school || 'N/A',
          'Post Type': c.postType || 'N/A',
          'Post ID': c.postId || 'N/A',
        })),
        ...(data.engagement?.views || []).map((v: any) => ({
          'Action Type': 'View',
          'Date': v.date ? new Date(v.date).toLocaleDateString() : 'N/A',
          'User': v.user || 'N/A',
          'Student': v.student || 'N/A',
          'School': v.school || 'N/A',
          'Post Type': v.postType || 'N/A',
          'Post ID': v.postId || 'N/A',
        })),
        ...(data.engagement?.saves || []).map((s: any) => ({
          'Action Type': 'Save',
          'Date': s.date ? new Date(s.date).toLocaleDateString() : 'N/A',
          'User': s.user || 'N/A',
          'User Role': s.userRole || 'N/A',
          'Student': s.student || 'N/A',
          'School': s.school || 'N/A',
          'Post Type': s.postType || 'N/A',
          'Post ID': s.postId || 'N/A',
        })),
      ];
      sheetName = 'Engagement';
    } else if (apiEndpoint.includes('/export/revenue')) {
      // Combine payments and Xen Watch revenue
      exportData = [
        ...(data.payments || []).map((p: any) => ({
          'Source': 'School Payment',
          'Payment ID': p.id,
          'Date': p.date ? new Date(p.date).toLocaleDateString() : 'N/A',
          'School': p.schoolName || 'N/A',
          'Amount': `$${Number(p.amount || 0).toFixed(2)}`,
          'Type': p.type?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'N/A',
          'Frequency': p.frequency || 'N/A',
          'Recorded By': p.recordedBy || 'System',
          'Notes': p.notes || '',
          'Limit Before': p.studentLimitBefore || '',
          'Limit After': p.studentLimitAfter || '',
        })),
        ...(data.xenWatchRevenue || []).map((x: any) => ({
          'Source': 'Xen Watch',
          'Transaction ID': x.id,
          'Date': x.date ? new Date(x.date).toLocaleDateString() : 'N/A',
          'Amount': `$${Number(x.amount || 0).toFixed(2)}`,
          'Status': x.status || 'N/A',
          'Submission ID': x.submissionId || 'N/A',
        })),
      ];
      sheetName = 'Revenue';
    }

    // Generate workbook
    const workbook = generateExcelWorkbook([{ name: sheetName, data: exportData, summary: data.summary }], [], options);

    // Download file
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
    const filename = `LockerRoom_${sheetName}_${date}_${time}.xlsx`;
    downloadExcelFile(workbook, filename);
  } catch (error) {
    console.error(`Export ${tabName} error:`, error);
    throw error;
  }
}

/**
 * Export all categories
 */
export async function exportAllCategories(
  period: string,
  options: ExportOptions = {}
): Promise<void> {
  try {
    const token = localStorage.getItem('token');
    const endpoints = [
      { name: 'Users', endpoint: '/api/system/analytics/export/users' },
      { name: 'Schools', endpoint: '/api/system/analytics/export/schools' },
      { name: 'Posts', endpoint: '/api/system/analytics/export/posts' },
      { name: 'Engagement', endpoint: '/api/system/analytics/export/engagement' },
      { name: 'Revenue', endpoint: '/api/system/analytics/export/revenue' },
    ];

    // Fetch all data
    const dataPromises = endpoints.map(({ endpoint }) =>
      fetch(`${endpoint}?period=${period}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      }).then(res => res.ok ? res.json() : null)
    );

    const allData = await Promise.all(dataPromises);

    // Transform data for each sheet
    const sheets: Array<{ name: string; data: any[]; summary?: any }> = [];

    // Executive Summary Sheet
    const summaryData = [
      { 'Metric': 'Total Users', 'Value': allData[0]?.summary?.total || 0 },
      { 'Metric': 'Active Users', 'Value': allData[0]?.summary?.active || 0 },
      { 'Metric': 'Total Schools', 'Value': allData[1]?.summary?.total || 0 },
      { 'Metric': 'Active Schools', 'Value': allData[1]?.summary?.active || 0 },
      { 'Metric': 'Total Posts', 'Value': allData[2]?.summary?.total || 0 },
      { 'Metric': 'Total Engagement', 'Value': (allData[3]?.summary?.totalLikes || 0) + (allData[3]?.summary?.totalComments || 0) + (allData[3]?.summary?.totalViews || 0) + (allData[3]?.summary?.totalSaves || 0) },
      { 'Metric': 'Total Revenue', 'Value': `$${(allData[4]?.summary?.totalRevenue || 0).toFixed(2)}` },
      { 'Metric': 'Xen Watch Revenue', 'Value': `$${(allData[4]?.summary?.xenWatchTotal || 0).toFixed(2)}` },
      { 'Metric': 'Export Period', 'Value': period },
      { 'Metric': 'Export Date', 'Value': new Date().toLocaleDateString() },
    ];
    sheets.push({ name: 'Executive Summary', data: summaryData });

    // Users Sheet
    if (allData[0]?.users) {
      const usersData = (allData[0].users || []).map((user: any) => ({
        'User ID': user.id,
        'Name': user.name || 'N/A',
        'Email': user.email || 'N/A',
        'Role': user.role || 'N/A',
        'School': user.schoolName || 'N/A',
        'Phone': user.phone || 'N/A',
        'Created Date': user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A',
        'Last Active': user.lastActive ? new Date(user.lastActive).toLocaleDateString() : 'Never',
        'Grade': user.grade || (user.role === 'student' ? 'N/A' : ''),
        'Position': user.position || (['student', 'school_admin'].includes(user.role) ? 'N/A' : ''),
        'Sport': user.sport || (user.role === 'student' ? 'N/A' : ''),
        'Role Number': user.roleNumber || (user.role === 'student' ? 'N/A' : ''),
      }));
      sheets.push({ name: 'Users', data: usersData, summary: allData[0].summary });
    }

    // Schools Sheet
    if (allData[1]?.schools) {
      const schoolsData = (allData[1].schools || []).map((school: any) => ({
        'School ID': school.id,
        'Name': school.name || 'N/A',
        'Address': school.address || 'N/A',
        'Contact Email': school.contactEmail || 'N/A',
        'Contact Phone': school.contactPhone || 'N/A',
        'Payment Amount': `$${Number(school.paymentAmount || 0).toFixed(2)}`,
        'Frequency': school.paymentFrequency || 'N/A',
        'Status': school.isActive ? 'Active' : 'Inactive',
        'Expires': school.subscriptionExpiresAt ? new Date(school.subscriptionExpiresAt).toLocaleDateString() : 'N/A',
        'Last Payment': school.lastPaymentDate ? new Date(school.lastPaymentDate).toLocaleDateString() : 'N/A',
        'Max Students': school.maxStudents || 0,
        'Current Students': school.studentCount || 0,
        'Admins': school.adminCount || 0,
        'Posts': school.postCount || 0,
        'Created Date': school.createdAt ? new Date(school.createdAt).toLocaleDateString() : 'N/A',
      }));
      sheets.push({ name: 'Schools', data: schoolsData, summary: allData[1].summary });
    }

    // Posts Sheet
    if (allData[2]?.posts) {
      const postsData = (allData[2].posts || []).map((post: any) => ({
        'Post ID': post.id,
        'Date': post.createdAt ? new Date(post.createdAt).toLocaleDateString() : 'N/A',
        'Student': post.studentName || 'N/A',
        'School': post.schoolName || 'N/A',
        'Type': post.mediaType || 'image',
        'Caption': post.caption || 'N/A',
        'Likes': post.engagement?.likes || 0,
        'Comments': post.engagement?.comments || 0,
        'Views': post.engagement?.views || 0,
        'Saves': post.engagement?.saves || 0,
        'Total Engagement': post.engagement?.total || 0,
        'Media URL': post.mediaUrl || 'N/A',
      }));
      sheets.push({ name: 'Posts', data: postsData, summary: allData[2].summary });
    }

    // Engagement Sheet
    if (allData[3]?.engagement) {
      const engagementData = [
        ...(allData[3].engagement.likes || []).map((l: any) => ({
          'Action Type': 'Like',
          'Date': l.date ? new Date(l.date).toLocaleDateString() : 'N/A',
          'User': l.user || 'N/A',
          'User Role': l.userRole || 'N/A',
          'Student': l.student || 'N/A',
          'School': l.school || 'N/A',
          'Post Type': l.postType || 'N/A',
          'Post ID': l.postId || 'N/A',
        })),
        ...(allData[3].engagement.comments || []).map((c: any) => ({
          'Action Type': 'Comment',
          'Date': c.date ? new Date(c.date).toLocaleDateString() : 'N/A',
          'User': c.user || 'N/A',
          'User Role': c.userRole || 'N/A',
          'Comment': c.comment || 'N/A',
          'Student': c.student || 'N/A',
          'School': c.school || 'N/A',
          'Post Type': c.postType || 'N/A',
          'Post ID': c.postId || 'N/A',
        })),
        ...(allData[3].engagement.views || []).map((v: any) => ({
          'Action Type': 'View',
          'Date': v.date ? new Date(v.date).toLocaleDateString() : 'N/A',
          'User': v.user || 'N/A',
          'Student': v.student || 'N/A',
          'School': v.school || 'N/A',
          'Post Type': v.postType || 'N/A',
          'Post ID': v.postId || 'N/A',
        })),
        ...(allData[3].engagement.saves || []).map((s: any) => ({
          'Action Type': 'Save',
          'Date': s.date ? new Date(s.date).toLocaleDateString() : 'N/A',
          'User': s.user || 'N/A',
          'User Role': s.userRole || 'N/A',
          'Student': s.student || 'N/A',
          'School': s.school || 'N/A',
          'Post Type': s.postType || 'N/A',
          'Post ID': s.postId || 'N/A',
        })),
      ];
      sheets.push({ name: 'Engagement', data: engagementData, summary: allData[3].summary });
    }

    // Revenue Sheet
    if (allData[4]) {
      const revenueData = [
        ...(allData[4].payments || []).map((p: any) => ({
          'Source': 'School Payment',
          'Payment ID': p.id,
          'Date': p.date ? new Date(p.date).toLocaleDateString() : 'N/A',
          'School': p.schoolName || 'N/A',
          'Amount': `$${Number(p.amount || 0).toFixed(2)}`,
          'Type': p.type?.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()) || 'N/A',
          'Frequency': p.frequency || 'N/A',
          'Recorded By': p.recordedBy || 'System',
          'Notes': p.notes || '',
          'Limit Before': p.studentLimitBefore || '',
          'Limit After': p.studentLimitAfter || '',
        })),
        ...(allData[4].xenWatchRevenue || []).map((x: any) => ({
          'Source': 'Xen Watch',
          'Transaction ID': x.id,
          'Date': x.date ? new Date(x.date).toLocaleDateString() : 'N/A',
          'Amount': `$${Number(x.amount || 0).toFixed(2)}`,
          'Status': x.status || 'N/A',
          'Submission ID': x.submissionId || 'N/A',
        })),
      ];
      sheets.push({ name: 'Revenue', data: revenueData, summary: allData[4].summary });
    }

    // Generate workbook
    const workbook = generateExcelWorkbook(sheets, [], options);

    // Download file
    const date = new Date().toISOString().split('T')[0];
    const time = new Date().toTimeString().split(' ')[0].replace(/:/g, '-');
    const filename = `LockerRoom_Platform_Analytics_All_${date}_${time}.xlsx`;
    downloadExcelFile(workbook, filename);
  } catch (error) {
    console.error('Export all categories error:', error);
    throw error;
  }
}

