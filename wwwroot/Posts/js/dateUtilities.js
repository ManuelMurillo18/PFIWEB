function convertToFrenchDate(numeric_date) {
    date = new Date(numeric_date);
    var options = { year: 'numeric', month: 'long', day: 'numeric' };
    var opt_weekday = { weekday: 'long' };
    var weekday = toTitleCase(date.toLocaleDateString("fr-FR", opt_weekday));

    function toTitleCase(str) {
        return str.replace(
            /\w\S*/g,
            function (txt) {
                return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
            }
        );
    }
    return weekday + " le " + date.toLocaleDateString("fr-FR", options) + " @ " + date.toLocaleTimeString("fr-FR");
}

function UTC_To_Local(UTC_numeric_date) {
    let UTC_Offset = new Date().getTimezoneOffset() / 60;
    let UTC_Date = new Date(UTC_numeric_date);
    UTC_Date.setHours(UTC_Date.getHours() - UTC_Offset);
    let Local_numeric_date = UTC_Date.getTime();
    return Local_numeric_date;
}

function Local_to_UTC(Local_numeric_date) {
    let UTC_Offset = new Date().getTimezoneOffset() / 60;
    let Local_Date = new Date(Local_numeric_date);
    Local_Date.setHours(Local_Date.getHours() + UTC_Offset);
    let UTC_numeric_date = Local_Date.getTime();
    return UTC_numeric_date;
}