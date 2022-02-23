The comment feature is an Enketo extension to the OpenRosa XForm spec that allows form designers to add a comment widget to individual questions. If funding allows this could quite easily be extended further by adding a comment to a group or the form as a whole.

This feature has the following characteristics:

-   A comment is coded in XForms like a separate question. It has it's own XML data node. This means that XPath can be used to add form logic that references this question, e.g. a dynamic "required" expression that specifies that a particular question is required unless it has a comment.
-   The `for` attribute, in the _http://enketo.org/xforms_ namespace, is used on the `<bind>` element to link a comment to a question.
-   An appearance is used to instantiate the widget. Without this appearance the comment input would show up as a regular question (and the `for` attribute would be ignored).
-   Optionally a custom-namespaced attribute could be added to the data node in the model in the XForm definition. Enketo will not use that information but it could be helpful to link user-entered data with a comment in the analysis.

This feature is not meant to be hand-coded into an XLSForm or XForm, as it quite tedious (but it can be done). It is meant to be added to advanced XLSForm or XForm form builders.

### How to use

To add a comment widget to a question, the following needs to be defined in the XLSForm:

#### Namespace

In XLSForm on the settings sheet, add a column `namespaces` and populate this with `enk=http://enketo.org/xforms`.

| form_title | namespaces                     |
| ---------- | ------------------------------ |
| My Form    | enk="http://enketo.org/xforms" |

#### Question

Add a question of type `text`, optionally with appearance `multiline`, preferably immediately after the question node it refers to (only for future printability of records - it doesn't affect functionality). The name of the question is free to choose.

| type | name      | label           | appearance |
| ---- | --------- | --------------- | ---------- |
| text | a         | Enter text      |            |
| text | a_comment | Enter a comment | multiline  |

#### Appearance

Give this question the appearance `comment` to ensure the question will be displayed as a comment widget.

| type | name      | label           | appearance        |
| ---- | --------- | --------------- | ----------------- |
| text | a         | Enter text      |                   |
| text | a_comment | Enter a comment | multiline comment |

#### Add a bind::enk:for column

For each comment question, add a reference to the question node it refers to in the `bind::enk:for` column, e.g. `${a}`. The prefix `enk` corresponds with the namespace prefix added on the settings sheet.

| type | name      | label           | appearance        | bind::enk:for |
| ---- | --------- | --------------- | ----------------- | ------------- |
| text | a         | Enter text      |                   |               |
| text | a_comment | Enter a comment | multiline comment | ${a}          |

#### Dynamic required

Optionally, if you'd like to make question "a" required only if there is no comment, you could use the regular XLSForm/XPath syntax. Nothing new here. You could do the same for relevant and constraint logic too.

| type | name      | label           | appearance        | bind::enk:for | required        |
| ---- | --------- | --------------- | ----------------- | ------------- | --------------- |
| text | a         | Enter text      |                   |               | $a_comment = '' |
| text | a_comment | Enter a comment | multiline comment | ${a}          |                 |

#### XForm sample

```xml
<?xml version="1.0"?>
<h:html xmlns="http://www.w3.org/2002/xforms" xmlns:enk="http://enketo.org/xforms" xmlns:ev="http://www.w3.org/2001/xml-events" xmlns:h="http://www.w3.org/1999/xhtml" xmlns:jr="http://openrosa.org/javarosa" xmlns:orx="http://openrosa.org/xforms" xmlns:xsd="http://www.w3.org/2001/XMLSchema">
  <h:head>
    <h:title>My Form</h:title>
    <model>
      <instance>
        <myform id="myform">
          <a/>
          <a_comment/>
          <meta>
            <instanceID/>
          </meta>
        </myform>
      </instance>
      <bind nodeset="/myform/a" required="/myform/a_comment = ''" type="string"/>
      <bind nodeset="/myform/a_comment" enk:for="/myform/a"  type="string"/>
      <bind nodeset="/myform/meta/instanceID" jr:preload="uid" type="string"/>
    </model>
  </h:head>
  <h:body>
    <input appearance="minimal" ref="/myform/a">
      <label>Enter text</label>
      <hint>required unless comment provided</hint>
    </input>
    <input appearance="comment multiline" ref="/myform/a_comment">
      <label>Enter a comment</label>
    </input>
  </h:body>
</h:html>

```
