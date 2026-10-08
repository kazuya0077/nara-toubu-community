(function () {
  'use strict';
  // 定例からの予定日。基準日のない隔週・不定期は日付を推測しない。
  window.ToubuCalendar = {
    occurs: function (schedule, date) {
      if (!schedule) return false;
      var days = Array.isArray(schedule.weekday) ? schedule.weekday : [schedule.weekday];
      if (schedule.freq === 'daily') return true;
      if (!days.includes(date.getDay())) return false;
      if (schedule.freq === 'weekly') return true;
      if (schedule.freq === 'monthly_nth') return Math.floor((date.getDate() - 1) / 7) + 1 === Number(schedule.nth);
      return false;
    }
  };
})();
