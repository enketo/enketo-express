# /accounts/api/v1

## Authentication
`Authorization Basic [account manager api key]:`

## Response
An account JSON response looks like this:

```
{
	"server_url": "https://oc2.com/study1",
	"api_key": "abcde",
	"code": "200" // don't use this, use HTTP Response Code instead
}
```
An error JSON response looks like this:

```
{
	"message": "Not Found. The account was not found."
	"code": "404" // don't use this, use HTTP Response Code instead
}
```
## Endpoints

**GET /account** with param server_url [required]

 - 200 response with account as body
 - errors: 400, 401, **403**,  
 - try `curl --user ocrocks: "http://localhost:8005/accounts/api/v1/account?server_url=https://octest.com/study1&api_key=abc"`

**POST /account** with param server_url [required] and api_key [required]

 - 200/201 response with account as body
 - errors: 400, 401, 409
 - _cannot be used to update an existing record (use PUT)_
 - try `curl --user ocrocks: -d "server_url=https://octest.com/study1&api_key=123" http://localhost:8005/accounts/api/v1/account`

**PUT /account** with param server_url [required] and api_key [optional]

 - 200/201 response with account as body
 - errors: 400, 401, 404
 - try `curl -X PUT --user ocrocks: -d "server_url=https://octest.com/study1&api_key=changed" http://localhost:8005/accounts/api/v1/account`

**DELETE /account** with param server_url [required]

 - 204 response with _EMPTY_ body
 - errors: 400, 401, 404, 405
 - try `curl -X DELETE --user ocrocks: -d "server_url=https://octest.com/study1" http://localhost:8005/accounts/api/v1/account`

**GET /list**

 - 200 response with array of accounts as body
 - try `curl --user ocrocks: "http://localhost:8005/accounts/api/v1/list"`
