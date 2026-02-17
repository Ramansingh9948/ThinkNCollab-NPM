import axios from "axios"

let data = {
    
}

function sendData() {
    const res = axios.post('http://172.16.44.215:5001/senddata', 
        {
            "name": "Raman Singh",
            "email": "admin@thinkncollab.com"
        }
    );

}
sendData();