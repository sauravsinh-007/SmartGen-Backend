const { getMessaging } = require('../config/firebase');
const User = require('../models/User');
const WeeklyPlan = require('../models/WeeklyPlan');
const ClothingItem = require('../models/ClothingItem');
const logger = require('../utils/logger');

const sendPushNotification = async (fcmToken, title, body, data = {}) => {
  if (!fcmToken) return { success: false, reason: 'No FCM token' };

  try {
    const messaging = getMessaging();
    await messaging.send({
      token: fcmToken,
      notification: { title, body },
      data: Object.fromEntries(
        Object.entries(data).map(([k, v]) => [k, String(v)])
      ),
      android: {
        priority: 'high',
        notification: { channelId: 'wardrobeai_default', sound: 'default' },
      },
      apns: {
        payload: { aps: { sound: 'default', badge: 1 } },
      },
    });
    return { success: true };
  } catch (error) {
    logger.error('Push notification failed:', error.message);
    return { success: false, error: error.message };
  }
};

const sendDailyOutfitReminders = async () => {
  try {
    const users = await User.find({
      fcmToken: { $ne: null },
      'preferences.notificationsEnabled': true,
      isActive: true,
    }).select('fcmToken preferences.dailyReminderTime');

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let sent = 0;
    for (const user of users) {
      const plan = await WeeklyPlan.findOne({
        user: user._id,
        weekStartDate: { $lte: new Date() },
        weekEndDate: { $gte: today },
        status: 'active',
      });

      if (!plan) continue;

      const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][today.getDay()];
      const todayPlan = plan.days.find((d) => d.day === dayName);

      if (todayPlan?.outfit?.top) {
        const topItem = await ClothingItem.findById(todayPlan.outfit.top).select('name');
        const bottomItem = await ClothingItem.findById(todayPlan.outfit.bottom).select('name');

        const outfitDesc = [topItem?.name, bottomItem?.name].filter(Boolean).join(' + ');

        const result = await sendPushNotification(
          user.fcmToken,
          "Good morning! Your outfit is ready 👔",
          `Today's look: ${outfitDesc}`,
          { type: 'daily_outfit', day: dayName }
        );
        if (result.success) sent++;
      }
    }

    logger.info(`Daily outfit reminders sent: ${sent}/${users.length}`);
  } catch (error) {
    logger.error('Error sending daily reminders:', error);
  }
};

const sendWeeklyPlanReady = async (userId, fcmToken) => {
  return sendPushNotification(
    fcmToken,
    "Your weekly outfit plan is ready! 🗓️",
    "AI has generated 7 personalized outfits for your week.",
    { type: 'weekly_plan_ready' }
  );
};

const sendWardrobeInsight = async (fcmToken, insight) => {
  return sendPushNotification(
    fcmToken,
    "Wardrobe Insight 💡",
    insight,
    { type: 'wardrobe_insight' }
  );
};

module.exports = {
  sendPushNotification,
  sendDailyOutfitReminders,
  sendWeeklyPlanReady,
  sendWardrobeInsight,
};
