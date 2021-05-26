function disableFields() {
    console.log("Disabling fields");
    var inputs = document.getElementsByTagName("input"); 
    for (var i = 0; i < inputs.length; i++) { 
        inputs[i].disabled = true;
    }

    var textarea = document.getElementsByTagName("textarea"); 
    for (var i = 0; i < textarea.length; i++) { 
        textarea[i].disabled = true;
    } 

    var button = document.getElementsByTagName("button"); 
    for (var i = 0; i < button.length; i++) { 
        button[i].disabled = true;
    } 
}
setTimeout(() => {disableFields()}, 1000);
setTimeout(() => {disableFields()}, 2000);
setTimeout(() => {disableFields()}, 3000);
setTimeout(() => {disableFields()}, 4000);