package com.smartbusiness.os;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AppVersionTest {
  @Autowired MockMvc mvc;

  @Test
  void releaseMetadataIsPublicAndComplete() throws Exception {
    mvc.perform(get("/api/app-version"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.latestVersion").value("1.1.1"))
        .andExpect(jsonPath("$.minimumSupportedVersion").value("1.1.0"))
        .andExpect(jsonPath("$.downloadUrl").value("https://smart-business-os.vercel.app/download"))
        .andExpect(jsonPath("$.releaseNotes[0]").value("Quicker startup"));
  }
}
