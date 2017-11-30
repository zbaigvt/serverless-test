module.exports = {
  MONTHS: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'],
  // month is zero based
  addMonths: function(year, month, n_months){
    month+=n_months;
    while(month > 12){
      year++;
      month-=12;
    }
    while(month < 1){
      year--;
      month+=12;
    }
    return [year, month];
  },
  /**
   * Return a timestamp with the format:
   "2016-07-06T182434"
   */
  getDate: function(){
    return new Date().toISOString().replace(/:/g, '').replace(/\..*$/,'');
  }
}
