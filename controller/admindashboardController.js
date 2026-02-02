const { BetaAnalyticsDataClient } = require('@google-analytics/data');

const analyticsClient = new BetaAnalyticsDataClient({
  keyFilename: './ga-key.json' // your service account key
});

const PROPERTY_ID = 'properties/521725143';

exports.getDashboardStats = async (req, res) => {
  try {
    // Active users
    const [activeUsersRes] = await analyticsClient.runReport({
      property: PROPERTY_ID,
      dateRanges: [{ startDate: 'today', endDate: 'today' }],
      metrics: [{ name: 'activeUsers' }]
    });

    // New users
    const [newUsersRes] = await analyticsClient.runReport({
      property: PROPERTY_ID,
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      metrics: [{ name: 'newUsers' }]
    });

    // Event count
    const [eventsRes] = await analyticsClient.runReport({
      property: PROPERTY_ID,
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      metrics: [{ name: 'eventCount' }]
    });

    // Country data
    const [countryRes] = await analyticsClient.runReport({
      property: PROPERTY_ID,
      dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
      dimensions: [{ name: 'country' }],
      metrics: [{ name: 'activeUsers' }]
    });

    const countryData = countryRes.rows?.map(row => ({
      country: row.dimensionValues[0].value,
      users: Number(row.metricValues[0].value)
    })) || [];

    res.json({
      activeUsers: activeUsersRes.rows?.[0]?.metricValues[0].value || 0,
      newUsers: newUsersRes.rows?.[0]?.metricValues[0].value || 0,
      eventCount: eventsRes.rows?.[0]?.metricValues[0].value || 0,
      countryData
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch GA data' });
  }
};

