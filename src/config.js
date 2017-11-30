
var environments = {
  prod: {
    // BASE_URL: "https://nusoa.northwestern.edu"
    BASE_URL: "https://reporting.northwestern.edu/bi/cgi-bin/cognosisapi.dll/rds/reportData/searchPath//content/folder[@name='Research_Dashboard']/folder[@name='Web_Services']/reportView[@name='%COGNOS_REPORT_NAME%']",
    DICTIONARY_URL: "https://erads02.ci.northwestern.edu:9443/ibm/iis/igc-rest/v1/search/?types=term&properties=long_description&properties=name&properties=short_description&where=%7B%22conditions%22%3A%5B%7B%22property%22%3A%20%22parent_category.name%22%2C%20%22operator%22%3A%20%22%3D%22%2C%20%22value%22%3A%20%5B%20%22Research%20Portal%22%20%5D%20%7D%20%5D%2C%20%22operator%22%3A%22and%22%20%7D&begin=0&pageSize=999&applyCriteriaToProperties=true",
    PROTOCOLS_NetID_URLS: ["https://eacuc.northwestern.edu/NWProd/PublicCustomLayouts/AWS/getActiveProtocolsByPINetID?pinetid=", "https://eirbplus.northwestern.edu/IRB/PublicCustomLayouts/AWS/getActiveProtocolsByPINetID?pinetid="],
    IACUCProID_URL: "https://eacuc.northwestern.edu/NWProd/PublicCustomLayouts/AWS/getActiveProtocolByID?id=",
    IRBProID_URL: "https://eirbplus.northwestern.edu/IRB/PublicCustomLayouts/AWS/getActiveProtocolByID?id=",

  },
  stage: {
    // BASE_URL: "https://nusoaqa.northwestern.edu"
    BASE_URL: "https://reportingtest.northwestern.edu/bi/cgi-bin/cognosisapi.dll/rds/reportData/searchPath//content/folder[@name='Research_Dashboard']/folder[@name='Web_Services']/reportView[@name='%COGNOS_REPORT_NAME%']",
    DICTIONARY_URL: "https://erads02.ci.northwestern.edu:9443/ibm/iis/igc-rest/v1/search/?types=term&properties=long_description&properties=name&properties=short_description&where=%7B%22conditions%22%3A%5B%7B%22property%22%3A%20%22parent_category.name%22%2C%20%22operator%22%3A%20%22%3D%22%2C%20%22value%22%3A%20%5B%20%22Research%20Portal%22%20%5D%20%7D%20%5D%2C%20%22operator%22%3A%22and%22%20%7D&begin=0&pageSize=999&applyCriteriaToProperties=true",
    PROTOCOLS_NetID_URLS: ["https://riseacweb.orad.northwestern.edu/NU-test/PublicCustomLayouts/AWS/getActiveProtocolsByPINetID?pinetid=", "https://eirbplus-test.northwestern.edu/IRB-Practice3/PublicCustomLayouts/AWS/getActiveProtocolsByPINetID?pinetid="],
    IACUCProID_URL: "https://riseacweb.orad.northwestern.edu/NU-test/PublicCustomLayouts/AWS/getActiveProtocolByID?id=",
    IRBProID_URL: "https://eirbplus-test.northwestern.edu/IRB-Practice3/PublicCustomLayouts/AWS/getActiveProtocolByID?id=",

  },
  dev: {
    // BASE_URL: "https://nusoadev.northwestern.edu"
    BASE_URL: "https://reportingdev.northwestern.edu/bi/cgi-bin/cognosisapi.dll/rds/reportData/searchPath//content/folder[@name='Research_Dashboard']/folder[@name='Web_Services']/reportView[@name='%COGNOS_REPORT_NAME%']",
    DICTIONARY_URL: "https://erads02.ci.northwestern.edu:9443/ibm/iis/igc-rest/v1/search/?types=term&properties=long_description&properties=name&properties=short_description&where=%7B%22conditions%22%3A%5B%7B%22property%22%3A%20%22parent_category.name%22%2C%20%22operator%22%3A%20%22%3D%22%2C%20%22value%22%3A%20%5B%20%22Research%20Portal%22%20%5D%20%7D%20%5D%2C%20%22operator%22%3A%22and%22%20%7D&begin=0&pageSize=999&applyCriteriaToProperties=true",
    // DICTIONARY_URL: "https://erads02.ci.northwestern.edu:9443/ibm/iis/igc-rest/v1/search/?types=term&properties=long_description&properties=short_description&pageSize=999&applyCriteriaToProperties=true"
    PROTOCOLS_NetID_URLS: ["https://riseacweb.orad.northwestern.edu/NU-test/PublicCustomLayouts/AWS/getActiveProtocolsByPINetID?pinetid=", "https://eirbplus-test.northwestern.edu/IRB-Practice3/PublicCustomLayouts/AWS/getActiveProtocolsByPINetID?pinetid="],
    IACUCProID_URL: "https://riseacweb.orad.northwestern.edu/NU-test/PublicCustomLayouts/AWS/getActiveProtocolByID?id=",
    IRBProID_URL: "https://eirbplus-test.northwestern.edu/IRB-Practice3/PublicCustomLayouts/AWS/getActiveProtocolByID?id=",

  }
}

module.exports = {
  environments: environments
}
