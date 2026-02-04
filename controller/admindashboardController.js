const { BetaAnalyticsDataClient } = require('@google-analytics/data');

let client;
try {
  client = new BetaAnalyticsDataClient({
    keyFilename: 'ga-key.json' 
  });
  console.log('✅ Google Analytics Client Initialized');
} catch (err) {
  console.error('❌ Failed to initialize GA client:', err.message);
}

const PROPERTY_ID = 'properties/521725143';

exports.getAdminDashboardPage = (req, res) => {
  res.render('admindashboard', {
    userName: req.session.userName,
    userType: req.session.userType
  });
};

exports.debugGAResponse = async (req, res) => {
  try {
    const todayVisitors = await client.runReport({
      property: PROPERTY_ID,
      dateRanges: [{ startDate: 'today', endDate: 'today' }],
      metrics: [{ name: 'activeUsers' }]
    });

    res.json({
      rawResponse: todayVisitors,
      rows: todayVisitors?.rows,
      firstRow: todayVisitors?.rows?.[0],
      metricValues: todayVisitors?.rows?.[0]?.metricValues,
      value: todayVisitors?.rows?.[0]?.metricValues?.[0]?.value
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAdminDashboardStats = async (req, res) => {
  try {
    console.log('🚀 Fetching live GA4 stats...');

    // 1. Today's Core Stats (Daily Active Users, Events, New Users)
    const [dailyReport] = await client.runReport({
      property: PROPERTY_ID,
      dateRanges: [{ startDate: 'today', endDate: 'today' }],
      metrics: [
        { name: 'activeUsers' },
        { name: 'eventCount' },
        { name: 'newUsers' }
      ],
    });

    // 2. Weekly Active Users (Last 7 Days)
    const [weeklyReport] = await client.runReport({
      property: PROPERTY_ID,
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      metrics: [{ name: 'activeUsers' }],
    });

    // 3. Real-time Stats (Active in last 30 mins + Country breakdown)
    const [realtimeReport] = await client.runRealtimeReport({
      property: PROPERTY_ID,
      metrics: [{ name: 'activeUsers' }],
      dimensions: [{ name: 'country' }]
    });

    // Safe extraction of values
    const dailyRow = dailyReport.rows?.[0]?.metricValues || [];
    const weeklyUsers = weeklyReport.rows?.[0]?.metricValues?.[0]?.value || '0';
    
    // Sum up real-time users from all countries listed
    const rtUsers = realtimeReport.rows?.reduce((acc, row) => 
      acc + parseInt(row.metricValues[0].value), 0) || 0;

    // Send JSON to your dashboard
    res.json({
      visitorsToday: dailyRow[0]?.value || '0',
      weeklyUsers: weeklyUsers,
      activeUsers: dailyRow[0]?.value || '0', 
      eventCount: dailyRow[1]?.value || '0',
      newUsers: dailyRow[2]?.value || '0',
      realtimeUsers: rtUsers.toString(),
      countryStats: realtimeReport.rows || []
    });

  } catch (err) {
    console.error('❌ API Error:', err.message);
    res.status(500).json({ 
      error: 'Failed to fetch live stats',
      message: err.message 
    });
  }
};
