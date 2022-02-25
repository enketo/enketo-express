When setting the following in config.json, Enketo will add 2 new attributes to repeat groups in the submission:

```json
{
    "repeat ordinals": true
}
```

The only known server that makes use of this feature is OpenClinica, so users of Ona, KoBoToolbox, ODK Aggregate should probably leave this feature switched off.

If a repeat has not been cloned, i.e. there is only one repeat instance, no attributes are added, so this feature does not appear.

From the moment a repeat is cloned for the first time, Enketo will start adding the new ordinal attributes (including for the first instance of the repeat) to the repeat node in the XML model.

The `ordinal` attribute in the Enketo XForms namespace indicates a sequential 1-based ordinal at the time the repeat was created. The value never changes. If a repeat is deleted, that ordinal number will never be re-used. The ordinal attribute is added to each repeat in a series.

The `last-used-ordinal` attribute in the Enketo XForms namespace indicates the last ordinal value that was used for that particular repeat. This attribute is only added to the first repeat in a series.

Below is a simple example of a model where 5 persons have been created but person 2 and person 5 have been deleted:

```xml
<data xmlns:enk=”http://enketo.org/xforms”>
	<person enk:last-used-ordinal=”5” enk:ordinal=”1”>
    	<firstname>krikor</firstname>
	</person>
	<person enk:ordinal=”3”>
        <firstname>jessica</firstname>
	</person>
	<person enk:ordinal=”4”>
        <firstname>steve</firstname>
	</person>
</data>
```

If a new person is created in the above example, this person will get ordinal “6”.

A more complex ordinal example with nested repeats could look like this:

```xml
<data xmlns:enk=”http://enketo.org/xforms”>
	<person enk:last-used-ordinal=”4” enk:ordinal=”1”>
    	<firstname>krikor</firstname>
    	<award enk:last-used-ordinal="4" enk:ordinal="1">
    		<name>some prize</name>
    	</award>
    	<award enk:ordinal="4">
    		<name>some prize</name>
    	</award>
	</person>
	<person enk:ordinal=”3”>
        <firstname>jessica</firstname>
        <award enk:last-used-ordinal="3" enk:ordinal="1">
    		<name>some prize</name>
    	</award>
    	<award enk:ordinal="2">
    		<name>some prize</name>
    	</award>
    	<award enk:ordinal="3">
    		<name>some prize</name>
    	</award>
	</person>
</data>

```

### Warning:

Internet Explorer 11 will put the `xmlns:enk="http://enketo.org/xforms"` namespace declaration on the nodes where the attributes are used, so multiple times, instead of the more efficient single namespace declaration on the root node. E.g. the first example looks like this in IE11:

```xml
<data>
	<person xmlns:enk=”http://enketo.org/xforms” enk:last-used-ordinal=”5” enk:ordinal=”1”>
    	<firstname>krikor</firstname>
	</person>
	<person xmlns:enk=”http://enketo.org/xforms” enk:ordinal=”3”>
        <firstname>jessica</firstname>
	</person>
	<person xmlns:enk=”http://enketo.org/xforms” enk:ordinal=”4”>
        <firstname>steve</firstname>
	</person>
</data>
```
