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
    console.log('🚀 getAdminDashboardStats called');

    res.json({
      visitorsToday: 5,
      weeklyUsers: 5,
      activeUsers: 5,
      eventCount: 208,
      newUsers: 4,
      realtimeUsers: 4,
      countryStats: [
        {
          dimensionValues: [{ value: 'Singapore' }],
          metricValues: [{ value: '4' }]
        }
      ]
    });

  } catch (err) {
    console.error('❌ Error:', err.message);
    res.json({
      visitorsToday: 0,
      weeklyUsers: 0,
      activeUsers: 0,
      eventCount: 0,
      newUsers: 0,
      realtimeUsers: 0,
      countryStats: []
    });
  }
};