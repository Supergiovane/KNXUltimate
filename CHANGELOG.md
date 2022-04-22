![Sample Node](img/logo.png)

[![Donate via PayPal](https://img.shields.io/badge/Donate-PayPal-blue.svg?style=flat-square)](https://www.paypal.me/techtoday) 

<br/>

# CHANGELOG

<p>
<b>Version 1.0.19</b> - April 2022<br/>
- Protected some functions to avoid issues in case of misuse.<br/>
- The ACK of received telegrams is now called befor the "indication" event is emitted to the client.<br/>
- Fixed some issues in the disconnection mechanism.<br/>
</p>
<p>
<b>Version 1.0.18</b> - April 2022<br/>
- NEW: new event has been added. The ackReceived event is triggered every time a telegram is sent over TunnelUDP or TunnelTCP, after it has been acknowledged or not acknowledged. Please see the full featured sample.js file.<br/>
</p>
<p>
<b>Version 1.0.16</b> - April 2022<br/>
- Changed: the KNX Gateway don't care anymore for ROUTING_LOST_MESSAGE and ROUTING_BUSY. Previously, it was disconnecting. Now it only advises in LOG.<br/>
- Added sample on how to decode incoming datagram's values<br/>
- Updated README and samples.<br/>
</p>
<p>
<b>Version 1.0.15</b> - March 2022<br/>
- Further optimization for the garbage collector.<br/>
</p>
<p>
<b>Version 1.0.14</b> - March 2022<br/>
- Optimized memory allocation to allow the garbage collector to get rid of unref variables.<br/>
</p>
<p>
<b>Version 1.0.13</b> - March 2022<br/>
- Updated samples and fixed disconnection issues is some circumstaces, where the KNX IP Interface doesn't send the DISCONNECT_RESPONSE datagram to confirm the disconnection.<br/>
</p>
<p>
<b>Version 1.0.12</b> - February 2022<br/>
- FIX Datapoint 16.001: fixed an issue with the ISO8859-1 encoding.<br/>
</p>
<p>
<b>Version 1.0.11</b> - February 2022<br/>
- Added the property containing the decoded Keyring file, accessible by all modules referencing the "index.js".<br/>
- Updated the secure sample code.<br/>
</p>
<p>
<b>Version 1.0.10</b> - February 2022<br/>
- Added secure connection sample code.<br/>
</p>
<p>
<b>Version 1.0.9</b> - February 2022<br/>
- Fixed a file not found issue.<br/>
</p>
<p>
<b>Version 1.0.6</b> - February 2022<br/>
- More samples and property specification in the README.<br/>
</p>
<p>
<b>Version 1.0.3</b> - February 2022<br/>
- Added sample in the readme.<br/>
</p>
<p>
<b>Version 1.0.2</b> - February 2022<br/>
- First version.<br/>
</p>
