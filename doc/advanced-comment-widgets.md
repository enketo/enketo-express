## Advanced Comment Widgets

Advanced comments widgets enable adding and reading comments on a particular question as well as metadata for those comments. 

These widgets build upon the [generic comment feature](./comments) and keeps the following characteristics:

- A comment is coded in XForms like a separate question. 
- The `for` attribute, in the _http://enketo.org/xforms_ namespace, is used on the `<bind>` element in the same manner.
- An appearance is used to instantiate the widget.
- Optionally, a custom-namespaced attribute could be added to the data node in the model in the XForm definition.

The advanced comment widgets extend the generic comment feature by: populating the comment node with a stringified JSON data structure and a UI to accomplish this.

### Data Structure 

**TODO: Is this final? I could not find original document that outlined this and reverse-engineered the format from the code.**

```json
{
  "queries": [
    { 
      "type": "comment",
      "id": "",
      "date_time": "2016-09-01 15:01 -06:00",
      "comment": "This value seems impossible.",
      "status": "new",
      "assigned_to": "Maurice Moss (moss)",
      "notify": false
    }
  ],
  "logs": [
    {
      "type": "comment",
      "assigned_to": "Ada Clare (aclare)",
      "date_time": "2016-04-22 14:44:20 -06:00",
      "comment": "This is an older comment.", 
      "status": "updated",
      "user": "Maurice Moss (moss)"
    },
    { 
      "type": "audit",  
      "message": "Item data value updated from old_value to new_value.",  
      "date_time" : "2016-05-18 12:44:20 -06:00",
      "user" : "Jen Barber (jen)",
    }
  ]
}
```

### Discrepancy Notes Widget

The Discrepancy Note widget populates only the `queries` array in the JSON data model mentioned above. In addition it displays the `logs` in a readonly list.

To add a discrepancy note to a question, the following needs to be defined in the XLSForm:

#### Namespace

In XLSForm on the settings sheet, add a column `namespaces` and populate this with `enk=http://enketo.org/xforms`.

| form_title | namespaces                     |
|------------|--------------------------------|
| My Form    | enk="http://enketo.org/xforms" |


#### Question

Add a question of type `text`, optionally with appearance `multiline`, preferably immediately after the question node it refers to.

| type | name      | label           | appearance |
|------|-----------|-----------------|------------|
| text | a         | Enter text      |            |
| text | a_comment | Enter a comment | multiline  |

#### Appearance

Give this question the appearance `dn` to ensure the question will be displayed as a Discrepancy Note widget. You could have multiple complex comment widget appearances (space-separated) here.

| type | name      | label           | appearance   |
|------|-----------|-----------------|--------------|
| text | a         | Enter text      |              |
| text | a_comment | Enter a comment | multiline dn |


#### Add a bind::enk:for column

For each discrepancy note question, add a reference to the question node it refers to in the `bind::enk:for` column, e.g. `${a}`. The prefix `enk` corresponds with the namespace prefix added on the settings sheet.

| type | name      | label           | appearance   | bind::enk:for |
|------|-----------|-----------------|--------------|---------------|
| text | a         | Enter text      |              |               |
| text | a_comment | Enter a comment | multiline dn | ${a}          |

#### Dynamic required, constraint, relevant

Optionally, if you'd like to make question "a" required depending on whether there is a comment, you could use the regular XLSForm/XPath syntax. Nothing new here. You could do the same for relevant and constraint logic too.

| type | name      | label           | appearance   | bind::enk:for | required        |
|------|-----------|-----------------|--------------|---------------|-----------------|
| text | a         | Enter text      |              |               | $a_comment = '' |
| text | a_comment | Enter a comment | multiline dn | ${a}          |                 |

In addition there is `comment-status` function that can be used to check the status of a query. The argument of this function is a single node that stores the DN data structure. This function can be used in any XPath expression. E.g. the above required expression could also be: `${a_comment} = '' or comment-status($a_comment} = 'closed'`.

#### Users list

Add a secondary instance with id "_users" to the XForm, with the following (preferred) structure as *\_users.xml*:


```xml
<root>
    <item>
        <user_name>esummer</user_name>
        <first_name>Esther</first_name>
        <last_name>Summerson</last_name>
    </item>
    <item>
        <user_name>honoria</user_name>
        <first_name>Honoria</first_name>
        <last_name>Dedlock</last_name>
    </item>
</root>
```

Or alternatively, with the following structure as *\_users.csv*:

| user_name | first_name | last_name |
|-----------|------------|-----------|
| esummer   | Esther     | Summerson |
| honoria   | Honoria    | Dedlock   |



#### XForm sample

```xml
<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms" xmlns:enk="http://enketo.org/xforms" xmlns:ev="http://www.w3.org/2001/xml-events" xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa" xmlns:orx="http://openrosa.org/xforms" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <h:head>
    <h:title>My Form</h:title>
    <model>
      <instance>
        <dn id="dn">
          <a/>
          <a_comment/>
          <meta>
            <instanceID/>
          </meta>
        </dn>
      </instance>
      <instance id="_users" src="jr://file/_users.xml"/>
      <bind nodeset="/dn/a" required=" /dn/a_comment = ''" type="string"/>
      <bind enk:for=" /dn/a " nodeset="/dn/a_comment" type="string"/>
      <bind nodeset="/dn/meta/instanceID" readonly="true()" type="string"/>
    </model>
  </h:head>
  <h:body>
    <input appearance="minimal" ref="/dn/a">
      <label>Enter text</label>
      <hint>required unless comment provided</hint>
    </input>
    <input appearance="dn multiline" ref="/dn/a_comment">
      <label>Enter a comment</label>
    </input>
  </h:body>
</h:html>

```
